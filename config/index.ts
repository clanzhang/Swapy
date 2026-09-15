import path from 'path'

import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig(async (merge, { command, mode }) => {
  const root = path.resolve(__dirname, '..')

  const baseConfig: UserConfigExport = {
    projectName: 'swapy',
    date: '2025-1-1',
    // 375 设计稿：写 px 就是 iPhone 逻辑像素，和 NutUI 的设计基准一致
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    // NutUI React Taro 的组件（Button/Input/TextArea…）渲染的是 HTML 标签
    // （div / span / input），而 Taro 的内置组件表里没有这些。
    // 不装这个插件，小程序会在运行时抛 `Template tmpl_0_div not found`，
    // 对应区域直接不渲染 —— 而且只在开发者工具/真机的控制台里才看得到。
    plugins: ['@tarojs/plugin-html'],
    /**
     * 编译期常量。
     *
     * 小程序运行时没有 `process` 对象，任何没被替换掉的 `process.env.X`
     * 都会在启动瞬间抛 “process is not defined”。Taro 只会自动替换它
     * 已知的 key（.env 里出现过的），所以这里显式声明一次，
     * 保证即使没有 .env 文件也能被替换成字符串字面量。
     */
    defineConstants: {
      'process.env.TARO_APP_CLOUD_ENV': JSON.stringify(
        process.env.TARO_APP_CLOUD_ENV || '',
      ),
    },
    alias: {
      '@': path.resolve(root, 'src'),
    },
    sass: {
      // 每个 .scss 自动注入设计变量，组件里不用重复 @import
      resource: [path.resolve(root, 'src/styles/variables.scss')],
      projectDirectory: root,
    },
    copy: {
      patterns: [
        // 原生 tabBar 只能用本地图片，且 Taro 不会处理 app.config 里
        // iconPath 指向的文件，所以手动把 assets/ 拷进产物。
        // 图标由 pnpm gen:tab-icons 生成，产物已入库。
        //
        // 注意 `to` 是相对**项目根目录**解析的（见 WebpackPlugin.getCopyWebpackPlugin
        // 里的 path.resolve(appPath, to)），不是相对 outputRoot，所以要写 dist/。
        { from: 'assets/', to: 'dist/assets/' },
      ],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: { enable: false },
    },
    cache: {
      enable: false,
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        url: {
          enable: true,
          config: {
            limit: 1024,
          },
        },
        cssModules: {
          enable: false,
        },
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js',
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
        },
      },
    },
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
