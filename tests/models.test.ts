import { describe, expect, it } from 'vitest'
import {
  createAppInfo,
  createBounds,
  createDeviceInfo,
  createHierarchyInfo,
  createInputTextRequest,
  createLaunchAppRequest,
  createOperationResult,
  createPoint,
} from '../src/models.js'

describe('models', () => {
  describe('createPoint', () => {
    it('creates a frozen point', () => {
      const p = createPoint(100, 200)
      expect(p.x).toBe(100)
      expect(p.y).toBe(200)
      expect(Object.isFrozen(p)).toBe(true)
    })
  })

  describe('createBounds', () => {
    it('creates frozen bounds', () => {
      const b = createBounds(0, 10, 100, 200)
      expect(b).toEqual({ x1: 0, y1: 10, x2: 100, y2: 200 })
      expect(Object.isFrozen(b)).toBe(true)
    })
  })

  describe('createDeviceInfo', () => {
    it('creates frozen device info', () => {
      const info = createDeviceInfo('serial123', { model: 'Pixel 7' })
      expect(info.serialno).toBe('serial123')
      expect(info.data).toEqual({ model: 'Pixel 7' })
      expect(Object.isFrozen(info)).toBe(true)
    })
  })

  describe('createAppInfo', () => {
    it('creates frozen app info', () => {
      const info = createAppInfo({ name: 'com.tencent.mm' })
      expect(info.data).toEqual({ name: 'com.tencent.mm' })
      expect(Object.isFrozen(info)).toBe(true)
    })
  })

  describe('createHierarchyInfo', () => {
    it('creates frozen hierarchy info', () => {
      const info = createHierarchyInfo({ nodes: [] })
      expect(info.data).toEqual({ nodes: [] })
      expect(Object.isFrozen(info)).toBe(true)
    })
  })

  describe('createOperationResult', () => {
    it('creates result with success from data', () => {
      const result = createOperationResult({ success: true, message: 'ok' })
      expect(result.success).toBe(true)
      expect(result.data.message).toBe('ok')
    })

    it('defaults success to true when not present', () => {
      const result = createOperationResult({ message: 'ok' })
      expect(result.success).toBe(true)
    })

    it('handles explicit false', () => {
      const result = createOperationResult({ success: false })
      expect(result.success).toBe(false)
    })
  })

  describe('createLaunchAppRequest', () => {
    it('creates frozen request', () => {
      const req = createLaunchAppRequest('com.tencent.mm')
      expect(req.app_name).toBe('com.tencent.mm')
      expect(Object.isFrozen(req)).toBe(true)
    })
  })

  describe('createInputTextRequest', () => {
    it('creates frozen request', () => {
      const req = createInputTextRequest('hello')
      expect(req.text).toBe('hello')
      expect(Object.isFrozen(req)).toBe(true)
    })
  })
})
