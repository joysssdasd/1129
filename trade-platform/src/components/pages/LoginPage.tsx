import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { supabase } from '../../services/supabase'
import { User } from '../../types'
import { log } from '../../utils/logger'

type LoginMode = 'password' | 'code'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginMode, setLoginMode] = useState<LoginMode>('password') // 默认使用密码登录
  const [registerStep, setRegisterStep] = useState(1)
  const [showGuide, setShowGuide] = useState(false) // 显示使用指南
  
  // 通用字段
  const [phone, setPhone] = useState('')

  // 管理员手机号列表
  const ADMIN_PHONES = ['13011319329', '13001220766']
  
  // 检查是否为管理员手机号
  const isAdminPhone = (phoneNumber: string) => ADMIN_PHONES.includes(phoneNumber)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  
  // 注册专用字段
  const [wechatId, setWechatId] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false)
  
  const { setUser } = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Capture invitation code from URL on component mount
  useEffect(() => {
    // 支持两种参数格式：invite 和 ref
    const inviteParam = searchParams.get('invite') || searchParams.get('ref')
    if (inviteParam) {
      setInviteCode(inviteParam.toUpperCase())
      setMode('register')
    }
  }, [searchParams])

  // 密码强度检查
  const checkPasswordStrength = (pwd: string) => {
    if (pwd.length < 6) return { valid: false, message: '密码至少需要6位' }
    if (!/\d/.test(pwd)) return { valid: false, message: '密码必须包含数字' }
    if (!/[a-zA-Z]/.test(pwd)) return { valid: false, message: '密码必须包含字母' }
    return { valid: true, message: '密码强度良好' }
  }

  // 发送验证码
  const sendVerificationCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      alert('请输入正确的手机号')
      return
    }

    // 如果是登录模式，需要先检查手机号是否已注册
    if (mode === 'login') {
      try {
        // 调用 Edge Function 检查用户是否存在（绕过 RLS 问题）
        const { data: checkResult, error: checkError } = await supabase.functions.invoke('check-user-exists', {
          body: { phone }
        })

        log.log('检查用户结果:', { checkResult, checkError, phone })

        if (checkError) {
          log.error('检查用户失败:', checkError)
          alert(`检查用户失败: ${checkError.message}`)
          return
        }

        // 如果用户不存在，提示注册
        if (!checkResult?.data?.exists) {
          alert('该手机号未注册，请先注册')
          return
        }
      } catch (e) {
        log.error('检查用户时出错:', e)
        // 继续发送验证码
      }
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { phone }
      })

      if (error) throw error

      // 根据API响应显示不同的消息
      const message = data?.data?.message || '验证码已发送，请注意查收'
      alert(message)
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error: any) {
      alert(error.message || '发送失败')
    } finally {
      setLoading(false)
    }
  }

  // 密码登录 - 调用 Edge Function 验证
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    // 管理员禁止使用密码登录
    if (isAdminPhone(phone)) {
      alert('管理员账号请使用验证码登录')
      setLoginMode('code')
      return
    }

    setLoading(true)

    try {
      // 先检查用户是否存在
      const { data: checkResult, error: checkError } = await supabase.functions.invoke('check-user-exists', {
        body: { phone }
      })

      if (checkError || !checkResult?.data?.exists) {
        alert('该手机号未注册，请先注册')
        return
      }

      // 管理员特殊处理
      if (checkResult?.data?.isAdmin) {
        alert('管理员账号请使用验证码登录')
        setLoginMode('code')
        return
      }

      // 调用密码登录 Edge Function（如果有的话）
      // 暂时使用直接查询方式
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, phone, wechat_id, is_admin, points, created_at, password')
        .eq('phone', phone)
        .single()

      if (userError || !userData) {
        alert('该手机号未注册，请先注册')
        return
      }

      // 验证密码（这里简单明文比较，实际应该使用bcrypt）
      if (userData.password !== password) {
        alert('密码错误')
        return
      }

      // 构建符合User接口的对象
      const user: User = {
        id: userData.id,
        phone: userData.phone,
        wechat_id: userData.wechat_id,
        invite_code: '',
        points: userData.points,
        success_rate: 0,
        is_admin: userData.is_admin,
        created_at: userData.created_at,
        updated_at: userData.created_at
      }

      // 登录成功
      setUser(user)
      alert('登录成功')

      // 根据角色跳转
      if (userData.is_admin) {
        navigate('/admin')
      } else {
        navigate('/')
      }

    } catch (error: any) {
      alert('登录失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 验证码登录 - 调用 Edge Function
  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 验证码格式检查
      if (!/^\d{6}$/.test(verificationCode)) {
        alert('请输入6位数字验证码')
        setLoading(false)
        return
      }

      // 调用 auth-login Edge Function 进行验证码登录
      const { data: loginResult, error: loginError } = await supabase.functions.invoke('auth-login', {
        body: { phone, verification_code: verificationCode }
      })

      log.log('登录结果:', { loginResult, loginError })

      if (loginError) {
        throw new Error(loginError.message || '登录失败')
      }

      if (loginResult?.error) {
        throw new Error(loginResult.error.message || '登录失败')
      }

      if (!loginResult?.data?.user) {
        throw new Error('登录失败，未获取到用户信息')
      }

      const userData = loginResult.data.user

      // 构建符合User接口的对象
      const user: User = {
        id: userData.id,
        phone: userData.phone,
        wechat_id: userData.wechat_id,
        invite_code: userData.invite_code || '',
        points: userData.points,
        success_rate: userData.success_rate || 0,
        is_admin: userData.is_admin,
        created_at: userData.created_at,
        updated_at: userData.updated_at || userData.created_at
      }

      // 登录成功
      setUser(user)
      alert('登录成功')

      // 根据角色跳转
      if (userData.is_admin) {
        navigate('/admin')
      } else {
        navigate('/')
      }

    } catch (error: any) {
      alert(error.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  // 注册第一步：验证手机号
  const handleRegisterStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('verify-sms', {
        body: { phone, code: verificationCode }
      })

      if (error) throw error

      if (data?.data?.verified) {
        setPhoneVerified(true)
        setRegisterStep(2)
        alert('验证成功，请设置密码')
      }
    } catch (error: any) {
      alert(error.message || '验证失败')
    } finally {
      setLoading(false)
    }
  }

  // 注册第二步：设置密码和微信号
  const handleRegisterStep2 = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!wechatId) {
      alert('请输入微信号')
      return
    }

    const pwdCheck = checkPasswordStrength(password)
    if (!pwdCheck.valid) {
      alert(pwdCheck.message)
      return
    }

    if (password !== confirmPassword) {
      alert('两次密码输入不一致')
      return
    }

    if (!agreeDisclaimer) {
      alert('请先阅读并同意免责声明')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('register-with-password', {
        body: {
          phone,
          password,
          wechat_id: wechatId,
          invite_code: inviteCode || undefined
        }
      })

      if (error) throw error

      if (data?.data?.user) {
        setUser(data.data.user)
        setRegisterStep(3)
        setShowGuide(true) // 显示使用指南
      }
    } catch (error: any) {
      log.error('🔍 老王调试注册错误:', error)

      // 更详细的错误处理
      let errorMessage = '注册失败'

      if (error.message) {
        if (error.message.includes('该手机号已注册')) {
          errorMessage = '该手机号已注册，请直接登录或使用其他手机号'
        } else if (error.message.includes('请填写完整信息')) {
          errorMessage = '请填写完整的注册信息'
        } else if (error.message.includes('密码至少需要6位')) {
          errorMessage = '密码至少需要6位字符'
        } else if (error.message.includes('密码必须包含数字和字母')) {
          errorMessage = '密码必须同时包含数字和字母'
        } else if (error.message.includes('系统配置错误')) {
          errorMessage = '系统配置错误，请联系管理员'
        } else {
          errorMessage = `注册失败: ${error.message}`
        }
      }

      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // 渲染登录表单
  const renderLoginForm = () => {
    // 管理员手机号强制使用验证码登录
    const forceCodeLogin = isAdminPhone(phone)
    
    if (forceCodeLogin && loginMode === 'password') {
      setLoginMode('code')
    }
    
    if (loginMode === 'password' && !forceCodeLogin) {
      return (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label htmlFor="login-phone" className="block text-sm font-medium text-gray-700 mb-2">
              手机号
            </label>
            <input
              type="tel"
              id="login-phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入手机号"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <input
              type="password"
              id="login-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入密码"
              required
            />
          </div>

          <div className="flex justify-between items-center text-sm">
            <button
              type="button"
              onClick={() => setLoginMode('code')}
              className="text-gray-500 hover:text-blue-600 hover:underline"
            >
              使用验证码登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setRegisterStep(1)
              }}
              className="text-gray-500 hover:text-blue-600 hover:underline"
            >
              忘记密码？
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      )
    } else {
      return (
        <form onSubmit={handleCodeLogin} className="space-y-4">
          <div>
            <label htmlFor="code-login-phone" className="block text-sm font-medium text-gray-700 mb-2">
              手机号
            </label>
            <input
              type="tel"
              id="code-login-phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入手机号"
              required
            />
          </div>

          <div>
            <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
              验证码
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="verification-code"
                name="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入验证码"
                required
              />
              <button
                type="button"
                onClick={sendVerificationCode}
                disabled={countdown > 0 || loading || !phone}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}s` : '发送'}
              </button>
            </div>
          </div>

          {!isAdminPhone(phone) && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setLoginMode('password')}
                className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
              >
                使用密码登录
              </button>
            </div>
          )}
          
          {isAdminPhone(phone) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                管理员账号仅支持验证码登录
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      )
    }
  }

  // 渲染注册表单
  const renderRegisterForm = () => {
    if (registerStep === 1) {
      return (
        <form onSubmit={handleRegisterStep1} className="space-y-4">
          <div className="mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-sm font-medium">
                  3
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-600">手机验证</p>
          </div>

          <div>
            <label htmlFor="register-phone" className="block text-sm font-medium text-gray-700 mb-2">
              手机号
            </label>
            <input
              type="tel"
              id="register-phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入手机号"
              required
            />
          </div>

          <div>
            <label htmlFor="register-code" className="block text-sm font-medium text-gray-700 mb-2">
              验证码
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="register-code"
                name="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入验证码"
                required
              />
              <button
                type="button"
                onClick={sendVerificationCode}
                disabled={countdown > 0 || loading || !phone}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}s` : '发送'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '验证中...' : '下一步'}
          </button>
        </form>
      )
    } else if (registerStep === 2) {
      const pwdCheck = password ? checkPasswordStrength(password) : null

      return (
        <form onSubmit={handleRegisterStep2} className="space-y-4">
          <div className="mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div className="w-16 h-1 bg-green-600"></div>
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div className="w-16 h-1 bg-gray-300"></div>
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-sm font-medium">
                  3
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-600">设置密码</p>
          </div>

          <div>
            <label htmlFor="wechat-id" className="block text-sm font-medium text-gray-700 mb-2">
              微信号
            </label>
            <input
              type="text"
              id="wechat-id"
              name="wechatId"
              value={wechatId}
              onChange={(e) => setWechatId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入微信号（注册后不可修改）"
              required
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">
              设置密码
            </label>
            <input
              type="password"
              id="register-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="至少6位，包含数字和字母"
              required
            />
            {pwdCheck && (
              <p className={`mt-1 text-xs ${pwdCheck.valid ? 'text-green-600' : 'text-red-600'}`}>
                {pwdCheck.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
              确认密码
            </label>
            <input
              type="password"
              id="confirm-password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请再次输入密码"
              required
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600">两次密码输入不一致</p>
            )}
          </div>

          <div>
            <label htmlFor="invite-code" className="block text-sm font-medium text-gray-700 mb-2">
              邀请码（选填）
            </label>
            <input
              type="text"
              id="invite-code"
              name="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入邀请码（可获得额外积分）"
            />
          </div>

          {/* 安全提示区域 */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-amber-800 mb-2">重要安全提示</h3>
                <div className="text-sm text-amber-700 space-y-2">
                  <p>• 本平台专为专业商家设计，不建议个人买家使用</p>
                  <p>• 所有交易信息真实性需要自行核对</p>
                  <p>• 建议找共同群或交易活跃用户进行担保</p>
                  <p>• 平台不提供任何担保责任</p>
                  <p>• 用户需自行承担交易风险</p>
                </div>
              </div>
            </div>
          </div>

          {/* 免责声明勾选框 */}
          <div className="mt-4">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="agree-disclaimer"
                checked={agreeDisclaimer}
                onChange={(e) => setAgreeDisclaimer(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                required
              />
              <label htmlFor="agree-disclaimer" className="ml-3 text-sm text-gray-700">
                我已阅读并同意
                <a href="/agreement" target="_blank" className="text-blue-600 hover:underline mx-1">《用户协议》</a>
                和
                <a href="/agreement" target="_blank" className="text-blue-600 hover:underline mx-1">《隐私政策》</a>
                ，知晓并接受交易风险，自愿承担相应责任
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setRegisterStep(1)
                setAgreeDisclaimer(false)
              }}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              上一步
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '注册中...' : '完成注册'}
            </button>
          </div>
        </form>
      )
    } else {
      // 注册成功
      return (
        <div className="text-center space-y-6">
          <div className="mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div className="w-16 h-1 bg-green-600"></div>
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div className="w-16 h-1 bg-green-600"></div>
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
                  3
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-green-600">注册完成</p>
          </div>

          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">注册成功</h3>
            <p className="text-gray-600">恭喜您，已成功注册并获得100积分奖励！</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              您的账号已创建成功，现在可以开始发布交易信息了
            </p>
          </div>

          <button
            onClick={() => setShowGuide(true)}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors mb-2"
          >
            查看使用指南
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            直接进入平台
          </button>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
            牛牛基地
          </h1>
          <p className="text-center text-gray-500 mb-8">高效、可信的交易信息服务</p>

          {registerStep !== 3 && (
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setMode('login')
                  setRegisterStep(1)
                  setPhoneVerified(false)
                  setAgreeDisclaimer(false)
                }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                登录
              </button>
              <button
                onClick={() => {
                  setMode('register')
                  setRegisterStep(1)
                  setPhoneVerified(false)
                  setAgreeDisclaimer(false)
                }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'register'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                注册
              </button>
            </div>
          )}

          {mode === 'login' ? renderLoginForm() : renderRegisterForm()}

          {mode === 'register' && registerStep === 1 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                注册即可获得100积分奖励，使用邀请码完成首次发布可额外获得30积分
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 使用指南弹窗 */}
      {showGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <h2 className="text-2xl font-bold mb-2">🎉 欢迎来到牛牛基地！</h2>
              <p className="text-blue-100">快速上手指南，让您轻松开始交易</p>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 平台介绍 */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">💡</span>
                  平台简介
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  牛牛基地是一个专业的交易信息发布平台，为商家提供高效、便捷的信息发布和查看服务。
                  平台采用积分制度，确保信息质量和交易安全。
                </p>
              </div>

              {/* 快速开始 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🚀</span>
                  快速开始
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">浏览交易信息</h4>
                      <p className="text-sm text-gray-600">
                        在首页可以免费浏览所有交易信息，使用搜索和筛选功能快速找到您需要的内容
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">发布交易信息</h4>
                      <p className="text-sm text-gray-600">
                        点击底部"发布"按钮，填写交易信息。<span className="text-red-600 font-medium">发布需要消耗10积分</span>，
                        信息下架后会返还积分
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">查看联系方式</h4>
                      <p className="text-sm text-gray-600">
                        点击"交易"按钮查看发布者微信号。<span className="text-red-600 font-medium">每次查看消耗5积分</span>，
                        系统会自动复制微信号到剪贴板
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center font-bold">
                      4
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">获取更多积分</h4>
                      <p className="text-sm text-gray-600">
                        通过充值、邀请好友、发布真实信息等方式获得积分。每邀请一个好友注册可获得<span className="text-green-600 font-medium">100积分</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 积分说明 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">💰</span>
                  积分规则
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">• 注册奖励</span>
                    <span className="text-green-600 font-semibold">+100积分</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">• 邀请好友</span>
                    <span className="text-green-600 font-semibold">+100积分/人</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">• 发布信息</span>
                    <span className="text-red-600 font-semibold">-10积分</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">• 查看联系方式</span>
                    <span className="text-red-600 font-semibold">-5积分</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">• 信息下架返还</span>
                    <span className="text-green-600 font-semibold">+10积分</span>
                  </div>
                </div>
              </div>

              {/* 重要提示 */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  重要提示
                </h3>
                <ul className="space-y-2 text-sm text-red-800">
                  <li>• 平台仅提供信息发布服务，不参与任何交易</li>
                  <li>• 请务必核实交易对方身份和信息真实性</li>
                  <li>• 建议通过共同群或活跃用户进行担保交易</li>
                  <li>• 发现虚假信息请及时举报</li>
                  <li>• 所有交易风险由用户自行承担</li>
                </ul>
              </div>

              {/* 联系客服 */}
              <div className="bg-gray-50 rounded-lg p-5 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">需要帮助？</h3>
                <p className="text-sm text-gray-600 mb-3">
                  如有任何问题，请联系客服
                </p>
                <div className="flex justify-center gap-4">
                  <div className="text-sm">
                    <span className="text-gray-500">客服微信：</span>
                    <span className="font-semibold text-blue-600">niuniubase</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="border-t p-6 bg-gray-50">
              <button
                onClick={() => {
                  setShowGuide(false)
                  navigate('/')
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
              >
                开始使用牛牛基地
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
