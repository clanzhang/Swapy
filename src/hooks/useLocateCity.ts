import Taro from '@tarojs/taro'
import { useCallback, useState } from 'react'

import { useUserStore } from '@/store/userStore'
import { nearestCity } from '@/utils/city'
import type { LatLng } from '@/utils/geo'

/**
 * 问微信要一次当前位置。
 *
 * 只用 `getFuzzyLocation`：它只给到城市级精度，正好够做同城匹配，
 * 而且隐私门槛比精确的 `getLocation` 低。
 *
 * **不要加 getLocation 当兼容分支**：app.json 的 requiredPrivateInfos 里
 * 这两个接口互斥，同时声明会被开发者工具直接报错，接口全不可用。
 *
 * 失败时返回一个原因（errMsg），拿不到位置则 location 为 null，
 * 由调用方提示用户手动选城市。
 */
async function getCurrentPoint(): Promise<{ location: LatLng | null; errMsg: string }> {
  try {
    const res = await Taro.getFuzzyLocation({ type: 'wgs84' })
    if (res?.latitude) return { location: { lat: res.latitude, lng: res.longitude }, errMsg: '' }
    return { location: null, errMsg: '' }
  } catch (err) {
    const errMsg = String((err as { errMsg?: string })?.errMsg ?? err ?? '')
    return { location: null, errMsg }
  }
}

/** 把微信的报错翻译成人话 */
function describeFailure(errMsg: string): string {
  if (/not authorized|-80424/i.test(errMsg)) {
    // 接口权限还没开通（或隐私保护指引里没勾地理位置）
    return '小程序还没开通定位，请手动选择城市'
  }
  if (/auth deny|auth denied|authorize/i.test(errMsg)) {
    return '没授权定位，请手动选择城市'
  }
  return '没拿到定位，请手动选择城市'
}

export interface LocateResult {
  /** 匹配到的城市名；失败时为 null */
  city: string | null
  /** 可以直接 toast 的文案 */
  message: string
}

/**
 * 「定位到当前城市」。
 *
 * 微信的定位接口只返回经纬度，不返回城市名，所以拿到坐标后要自己匹配
 * （nearestCity：在全部城市的市中心里找最近的那个）。
 *
 * 注意：**只在用户主动点击时调用**。一进页面就弹授权框很劝退，
 * 而且和本项目「静默登录、不弹窗打断」的调性冲突。
 *
 * 成功后会把经纬度一起写进资料 —— 手选城市也会写城市中心点，
 * 否则 getCards 会一直拿默认的上海坐标算距离。
 */
export function useLocateCity(): { locate: () => Promise<LocateResult>; locating: boolean } {
  const updateProfile = useUserStore((s) => s.updateProfile)
  const [locating, setLocating] = useState(false)

  const locate = useCallback(async (): Promise<LocateResult> => {
    setLocating(true)
    try {
      const { location: point, errMsg } = await getCurrentPoint()
      if (!point) {
        return { city: null, message: describeFailure(errMsg) }
      }

      const city = nearestCity(point)
      if (!city) {
        return { city: null, message: '定位没匹配到城市，请手动选择' }
      }

      await updateProfile({ city, location: point })
      return { city, message: `已定位到${city}` }
    } catch {
      return { city: null, message: '定位失败，请手动选择城市' }
    } finally {
      setLocating(false)
    }
  }, [updateProfile])

  return { locate, locating }
}
