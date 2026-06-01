type ToastFn = (msg: string, type?: 'success' | 'error') => void

let _fn: ToastFn | null = null

export function _registerToast(fn: ToastFn) {
  _fn = fn
}

export function showToast(msg: string, type: 'success' | 'error' = 'success') {
  _fn?.(msg, type)
}
