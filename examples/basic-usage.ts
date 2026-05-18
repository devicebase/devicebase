/* eslint-disable no-console */
import process from 'node:process'
import { DeviceBaseClient } from '../src/index.js'

const client = new DeviceBaseClient({
  apiKey: process.env.API_KEY,
  serial: process.env.SERIAL!,
})

async function main() {
  // Get device info
  const deviceInfo = await client.getDeviceInfo()
  console.log('Device:', deviceInfo)

  // Take a screenshot
  const screenshot = await client.getScreenshot()
  console.log('Screenshot size:', screenshot.byteLength, 'bytes')

  // Perform touch operations
  await client.tap(100, 200)
  await client.doubleTap(100, 200)
  await client.longPress(100, 200)
  await client.swipe(100, 500, 100, 100)

  // Navigation
  await client.back()
  await client.home()

  // Launch an app
  await client.launchApp('com.tencent.mm')

  // Text input
  await client.inputText('hello world')
  await client.clearText()

  // Get current app
  const appInfo = await client.getCurrentApp()
  console.log('Current app:', appInfo)

  // Dump UI hierarchy
  const hierarchy = await client.dumpHierarchy()
  console.log('Hierarchy:', hierarchy)

  // Download screenshot as file
  const download = await client.downloadScreenshot()
  console.log('Download size:', download.byteLength, 'bytes')

  // Stream screen via WebSocket
  console.log('Streaming screen frames...')
  // eslint-disable-next-line no-unreachable-loop
  for await (const frame of client.streamMinicap()) {
    console.log('Frame:', frame.length, 'bytes')
    // Just get one frame for demo
    break
  }

  // Touch control via WebSocket
  const minitouch = client.minitouchClient()
  await minitouch.connect()
  await minitouch.tap(200, 300)
  await minitouch.swipe(100, 500, 100, 100, 300, 10)
  await minitouch.close()
}

main().catch(console.error)
