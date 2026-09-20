export { DeviceBaseClient } from './client.js'
export type { DeviceBaseClientConfig } from './client.js'

export {
  AuthenticationError,
  DeviceBaseError,
  DeviceBaseHttpClient,
  DeviceNotFoundError,
  ValidationError,
} from './http-client.js'
export type { HttpClientConfig, RequestOptions } from './http-client.js'

export type {
  AppInfo,
  Bounds,
  ComputerBashRequest,
  ComputerClickRequest,
  ComputerLongClickRequest,
  ComputerPointRequest,
  DeviceInfo,
  HierarchyInfo,
  InputTextRequest,
  KeysRequest,
  LaunchAppRequest,
  ListDevicesRequest,
  MouseButton,
  OperationResult,
  Point,
  ScrollDirection,
  ScrollRequest,
  SelectorRequest,
  SelectorValueRequest,
  TabIdRequest,
  UrlRequest,
  WaitRequest,
} from './models.js'

export {
  createAppInfo,
  createBounds,
  createDeviceInfo,
  createHierarchyInfo,
  createInputTextRequest,
  createLaunchAppRequest,
  createOperationResult,
  createPoint,
} from './models.js'

export { HttpTransport } from './transport.js'

export { VERSION } from './version.js'
export { MinicapClient, MinitouchClient } from './websocket-client.js'

export type { WebSocketClientConfig } from './websocket-client.js'
