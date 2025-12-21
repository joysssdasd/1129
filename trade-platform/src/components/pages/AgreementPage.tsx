import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function AgreementPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">用户协议与隐私政策</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-8">
          {/* 用户协议 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b">用户服务协议</h2>
            <p className="text-sm text-gray-500 mb-4">更新日期：2025年6月</p>
            
            <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">一、服务说明</h3>
                <p>牛牛基地（以下简称"本平台"）是一个信息撮合服务平台，为用户提供交易信息发布与浏览服务。</p>
                <p className="mt-2 text-red-600 font-medium">重要声明：本平台仅提供信息展示和撮合服务，不参与任何实际交易，不对交易标的、质量、价格、资金安全承担任何担保或赔偿责任。</p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">二、用户资格</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>本平台专为具有相关交易经验的专业商家设计</li>
                  <li>不建议普通个人消费者使用本平台进行交易</li>
                  <li>用户应具备完全民事行为能力</li>
                  <li>用户注册即表示已充分了解并接受本协议全部条款</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">三、实名认证</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>根据《互联网论坛社区服务管理规定》，用户需提供真实身份信息方可使用发布、查看联系方式等功能</li>
                  <li>本平台采用手机号+短信验证码方式完成后台实名认证</li>
                  <li>用户应确保注册信息真实、准确、完整</li>
                  <li>因用户提供虚假信息导致的一切后果由用户自行承担</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">四、用户行为规范</h3>
                <p>用户在使用本平台时，不得发布以下内容：</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>违反国家法律法规的信息</li>
                  <li>虚假、欺诈性交易信息</li>
                  <li>侵犯他人知识产权、隐私权等合法权益的信息</li>
                  <li>含有"保本收益""稳赚""跟单"等承诺性金融词汇的信息</li>
                  <li>涉及非法集资、传销、洗钱等违法活动的信息</li>
                  <li>其他违反公序良俗或平台规则的信息</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">五、交易风险提示</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <ul className="list-disc list-inside space-y-2 text-red-700">
                    <li>所有交易信息的真实性需用户自行核实</li>
                    <li>建议通过共同群或交易活跃用户进行担保</li>
                    <li>建议线下当面交易，核验货品后再付款</li>
                    <li>平台不提供资金托管、退款、仲裁等服务</li>
                    <li>用户需自行承担全部交易风险</li>
                    <li>市场有风险，投资决策需谨慎</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">六、积分规则</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>新用户注册赠送100积分</li>
                  <li>发布交易信息消耗10积分</li>
                  <li>查看联系方式消耗1积分</li>
                  <li>邀请好友完成首次发布，邀请人获得10积分，被邀请人获得30积分</li>
                  <li>积分可通过充值获得，充值比例为1元=10积分</li>
                  <li className="text-red-600 font-medium">积分一经充值不可退还，仅可用于平台内消费</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">七、免责声明</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <ul className="list-disc list-inside space-y-2 text-yellow-800">
                    <li>本平台仅为信息交流空间，不对用户发布的信息内容承担审核义务</li>
                    <li>用户因使用本平台信息进行交易产生的任何纠纷、损失，由交易双方自行协商解决</li>
                    <li>本平台不承担因用户交易行为产生的任何直接或间接损失</li>
                    <li>因不可抗力、系统故障等原因导致的服务中断，本平台不承担责任</li>
                    <li>本平台有权对违规内容进行删除、对违规用户进行封禁处理</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">八、举报与投诉</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>用户发现违法、侵权、虚假信息可通过举报功能进行举报</li>
                  <li>平台将在收到举报后24小时内进行处理</li>
                  <li>恶意举报将被追究相应责任</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">九、协议修改</h3>
                <p>本平台有权根据法律法规变化及运营需要修改本协议，修改后的协议将在平台公布。用户继续使用本平台即视为接受修改后的协议。</p>
              </div>
            </div>
          </section>

          {/* 隐私政策 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b">隐私政策</h2>
            
            <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">一、信息收集</h3>
                <p>我们收集以下信息用于提供服务：</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>手机号码：用于账号注册和身份验证</li>
                  <li>微信号：用于交易双方联系</li>
                  <li>设备信息：用于安全防护和服务优化</li>
                  <li>操作日志：用于服务改进和问题排查</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">二、信息使用</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>提供、维护和改进我们的服务</li>
                  <li>验证用户身份，保障账号安全</li>
                  <li>向用户发送服务通知</li>
                  <li>处理用户举报和投诉</li>
                  <li>遵守法律法规要求</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">三、信息保护</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>我们采用行业标准的安全措施保护用户信息</li>
                  <li>未经用户同意，不会向第三方披露用户个人信息</li>
                  <li>法律法规要求或政府部门依法调取除外</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2">四、用户权利</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>用户有权查询、更正自己的个人信息</li>
                  <li>用户有权注销账号（注销后数据将被删除）</li>
                  <li>用户有权拒绝接收营销信息</li>
                </ul>
              </div>
            </div>
          </section>

          <div className="pt-4 border-t">
            <p className="text-center text-gray-500 text-sm">
              如您对本协议有任何疑问，请通过平台客服联系我们
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
