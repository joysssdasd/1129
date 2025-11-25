import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, Image as ImageIcon, Trash2 } from 'lucide-react'

interface QRCodeManagerProps {
  onUpdate?: () => void
}

export default function QRCodeManager({ onUpdate }: QRCodeManagerProps) {
  const [wechatQR, setWechatQR] = useState<string>('')
  const [alipayQR, setAlipayQR] = useState<string>('')
  const [wechatUploading, setWechatUploading] = useState(false)
  const [alipayUploading, setAlipayUploading] = useState(false)

  useEffect(() => {
    loadQRCodes()
  }, [])

  const loadQRCodes = async () => {
    try {
      const { data } = await supabase.functions.invoke('get-payment-qrcodes')
      if (data?.data?.qrcodes) {
        const qrcodes = data.data.qrcodes
        const wechat = qrcodes.find((q: any) => q.payment_type === 'wechat')
        const alipay = qrcodes.find((q: any) => q.payment_type === 'alipay')
        
        if (wechat) setWechatQR(wechat.qr_code_url)
        if (alipay) setAlipayQR(alipay.qr_code_url)
      }
    } catch (error) {
      console.error('加载二维码失败:', error)
    }
  }

  const handleFileUpload = async (file: File, type: 'wechat' | 'alipay') => {
    const setUploading = type === 'wechat' ? setWechatUploading : setAlipayUploading
    
    setUploading(true)
    try {
      // 上传到Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${type}-${Date.now()}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-qrcodes')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // 获取公开URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-qrcodes')
        .getPublicUrl(fileName)

      // 保存到数据库
      const { error: saveError } = await supabase.functions.invoke('save-payment-qrcode', {
        body: {
          payment_type: type,
          qr_code_url: publicUrl
        }
      })

      if (saveError) throw saveError

      // 更新显示
      if (type === 'wechat') {
        setWechatQR(publicUrl)
      } else {
        setAlipayQR(publicUrl)
      }

      alert('二维码上传成功')
      if (onUpdate) onUpdate()
    } catch (error: any) {
      alert(error.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent, type: 'wechat' | 'alipay') => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file, type)
    } else {
      alert('请上传图片文件')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, type: 'wechat' | 'alipay') => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file, type)
    }
  }

  return (
    <div className="bg-white rounded-lg p-6 mb-6">
      <h3 className="font-semibold text-lg mb-4">收款二维码设置</h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* 微信收款码 */}
        <div>
          <label className="block text-sm font-medium mb-2">微信收款码</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition-colors"
            onDrop={(e) => handleDrop(e, 'wechat')}
            onDragOver={(e) => e.preventDefault()}
          >
            {wechatQR ? (
              <div className="relative">
                <img src={wechatQR} alt="微信收款码" className="max-h-48 mx-auto rounded-lg" />
                <div className="mt-3 flex gap-2 justify-center">
                  <label className="cursor-pointer px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200">
                    <Upload className="w-4 h-4 inline mr-1" />
                    更换
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileInput(e, 'wechat')}
                      disabled={wechatUploading}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="py-8">
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">拖拽图片到此处或点击上传</p>
                  <p className="text-xs text-gray-400">支持 JPG、PNG 格式</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileInput(e, 'wechat')}
                  disabled={wechatUploading}
                />
              </label>
            )}
            {wechatUploading && (
              <div className="mt-2 text-sm text-purple-600">上传中...</div>
            )}
          </div>
        </div>

        {/* 支付宝收款码 */}
        <div>
          <label className="block text-sm font-medium mb-2">支付宝收款码</label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition-colors"
            onDrop={(e) => handleDrop(e, 'alipay')}
            onDragOver={(e) => e.preventDefault()}
          >
            {alipayQR ? (
              <div className="relative">
                <img src={alipayQR} alt="支付宝收款码" className="max-h-48 mx-auto rounded-lg" />
                <div className="mt-3 flex gap-2 justify-center">
                  <label className="cursor-pointer px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200">
                    <Upload className="w-4 h-4 inline mr-1" />
                    更换
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileInput(e, 'alipay')}
                      disabled={alipayUploading}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="py-8">
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">拖拽图片到此处或点击上传</p>
                  <p className="text-xs text-gray-400">支持 JPG、PNG 格式</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileInput(e, 'alipay')}
                  disabled={alipayUploading}
                />
              </label>
            )}
            {alipayUploading && (
              <div className="mt-2 text-sm text-purple-600">上传中...</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          用户充值时将根据选择的支付方式展示对应的收款二维码。请确保二维码清晰可扫描。
        </p>
      </div>
    </div>
  )
}
