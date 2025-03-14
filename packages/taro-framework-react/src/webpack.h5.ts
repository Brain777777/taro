import { defaultMainFields, REG_TARO_H5, resolveSync } from '@tarojs/helper'
import { mergeWith } from 'lodash'

import { getLoaderMeta } from './loader-meta'

import type { IPluginContext } from '@tarojs/service'
import type Chain from 'webpack-chain'
import type { Frameworks } from './index'

export function modifyH5WebpackChain (ctx: IPluginContext, framework: Frameworks, chain: Chain) {
  setLoader(framework, chain)
  setPlugin(ctx, framework, chain)

  const { isBuildNativeComp = false } = ctx.runOpts?.options || {}
  const webpackConfig = chain.toConfig()
  const isProd = webpackConfig.mode === 'production'
  const externals: Record<string, { [externalType: string]: string } | string> = {}
  if (isBuildNativeComp && isProd) {
    // Note: 该模式不支持 prebundle 优化，不必再处理
    externals.react = {
      commonjs: 'react',
      commonjs2: 'react',
      amd: 'react',
      root: 'React'
    }
    externals['react-dom'] = {
      commonjs: 'react-dom',
      commonjs2: 'react-dom',
      amd: 'react-dom',
      root: 'ReactDOM'
    }
    if (framework === 'preact') {
      externals.preact = 'preact'
    }

    chain.merge({
      externalsType: 'umd'
    })
  }

  chain.merge({
    externals,
    module: {
      rule: {
        'process-import-taro-h5': {
          test: REG_TARO_H5,
          loader: require.resolve('./api-loader'),
        },
      },
    },
  })
}

function setLoader (framework: Frameworks, chain) {
  function customizer (object = '', sources = '') {
    if ([object, sources].every((e) => typeof e === 'string')) return object + sources
  }
  chain.plugin('mainPlugin').tap((args) => {
    args[0].loaderMeta = mergeWith(getLoaderMeta(framework), args[0].loaderMeta, customizer)
    return args
  })
}

function setPlugin (ctx: IPluginContext, framework: Frameworks, chain) {
  const config = ctx.initialConfig
  const webpackConfig = chain.toConfig()
  const isProd = webpackConfig.mode === 'production'
  if (!isProd && config.h5?.devServer?.hot !== false) {
    // 默认开启 fast-refresh
    if (framework === 'react') {
      chain.plugin('fastRefreshPlugin').use(require('@pmmmwh/react-refresh-webpack-plugin'))
    } else if (framework === 'preact') {
      chain.plugin('hotModuleReplacementPlugin').use(require('webpack').HotModuleReplacementPlugin)
      chain.plugin('fastRefreshPlugin').use(require('@prefresh/webpack'))
    }
  }

  const mainFields = ['unpkg', ...defaultMainFields]
  const resolveOptions = {
    basedir: process.cwd(),
    mainFields,
  }
  if (framework === 'react') {
    const alias = chain.resolve.alias
    // Note: 本地 link 调试时，避免 react 重复打包
    alias.set('react$', resolveSync('react', resolveOptions))
    alias.set('react-dom$', resolveSync('react-dom', resolveOptions))
  }
}
