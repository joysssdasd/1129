import { CheckCircle2, FileSpreadsheet, X } from 'lucide-react'

interface OrderDraftPromptProps {
  open: boolean
  subjectTitle?: string
  contact?: string
  onClose: () => void
  onCreateDraft: () => void
}

export default function OrderDraftPrompt({
  open,
  subjectTitle,
  contact,
  onClose,
  onCreateDraft,
}: OrderDraftPromptProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm">
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:inset-x-4 sm:bottom-4 sm:rounded-3xl">
        <div className="px-4 pb-4 pt-3 sm:px-6">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-draft-title"
            className="space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 id="order-draft-title" className="text-lg font-semibold text-gray-900">
                    联系方式已复制
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600 text-pretty">
                    {subjectTitle
                      ? `已从“${subjectTitle}”生成可编辑订单草稿，顺手就能先记下来。`
                      : '已生成可编辑订单草稿，顺手就能先记下来。'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭订单草稿提示"
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 ring-1 ring-slate-200">
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    当前订单信息
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {subjectTitle || '未命名标的'}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {contact ? `联系方式：${contact}` : '联系方式已复制到剪贴板，可继续联系后再补录'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                继续联系
              </button>
              <button
                type="button"
                onClick={onCreateDraft}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                一键生成订单草稿
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
