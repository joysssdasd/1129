import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Plus, Edit, Trash2, Save, X, GripVertical } from 'lucide-react'
import { toast } from '../services/toastService'

interface Category {
  id: string
  name: string
  icon: string
  description: string
  sort_order: number
  is_active: boolean
  post_count: number
  view_count: number
  deal_count: number
  created_at: string
  updated_at: string
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    description: '',
    sort_order: 0,
    is_active: true
  })

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error: any) {
      toast.error('加载板块失败', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入板块名称')
      return
    }

    try {
      const { error } = await supabase
        .from('categories')
        .insert([formData])

      if (error) throw error

      toast.success('添加板块成功')
      setShowAddForm(false)
      setFormData({
        name: '',
        icon: '📦',
        description: '',
        sort_order: 0,
        is_active: true
      })
      loadCategories()
    } catch (error: any) {
      toast.error('添加板块失败', error.message)
    }
  }

  const handleUpdate = async (id: string, updates: Partial<Category>) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      toast.success('更新板块成功')
      setEditingId(null)
      loadCategories()
    } catch (error: any) {
      toast.error('更新板块失败', error.message)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    // 不允许删除"其他分类"
    if (name === '其他分类') {
      toast.error('不能删除"其他分类"板块')
      return
    }

    if (!confirm(`确定要删除板块"${name}"吗？\n\n该板块下的所有交易信息将自动移至"其他分类"。`)) {
      return
    }

    try {
      // 先将该板块的所有交易信息移至"其他分类"
      const { data: otherCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('name', '其他分类')
        .single()

      if (otherCategory) {
        await supabase
          .from('posts')
          .update({ category_id: otherCategory.id })
          .eq('category_id', id)
      }

      // 删除板块
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success(`已删除板块"${name}"，相关交易信息已移至"其他分类"`)
      loadCategories()
    } catch (error: any) {
      toast.error('删除板块失败', error.message)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await handleUpdate(id, { is_active: !currentStatus })
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">板块管理</h2>
          <p className="text-sm text-gray-500 mt-1">
            当前板块数量：{categories.length} 个（建议保持4或6个板块）
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Plus size={20} />
          添加板块
        </button>
      </div>

      {/* 添加板块表单 */}
      {showAddForm && (
        <div className="bg-white p-4 rounded-lg border-2 border-blue-500 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">添加新板块</h3>
            <button onClick={() => setShowAddForm(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="板块名称"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="图标 (emoji)"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="px-3 py-2 border rounded"
            />
          </div>
          <textarea
            placeholder="板块描述"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              保存
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 板块列表 */}
      <div className="space-y-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className={`bg-white p-4 rounded-lg border ${
              !category.is_active ? 'opacity-50' : ''
            }`}
          >
            {editingId === category.id ? (
              // 编辑模式
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={category.name}
                    onChange={(e) => {
                      const updated = categories.map(c =>
                        c.id === category.id ? { ...c, name: e.target.value } : c
                      )
                      setCategories(updated)
                    }}
                    className="px-3 py-2 border rounded"
                    disabled={category.name === '其他分类'}
                  />
                  <input
                    type="text"
                    value={category.icon}
                    onChange={(e) => {
                      const updated = categories.map(c =>
                        c.id === category.id ? { ...c, icon: e.target.value } : c
                      )
                      setCategories(updated)
                    }}
                    className="px-3 py-2 border rounded"
                  />
                </div>
                <textarea
                  value={category.description || ''}
                  onChange={(e) => {
                    const updated = categories.map(c =>
                      c.id === category.id ? { ...c, description: e.target.value } : c
                    )
                    setCategories(updated)
                  }}
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(category.id, {
                      name: category.name,
                      icon: category.icon,
                      description: category.description
                    })}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    <Save size={16} />
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null)
                      loadCategories()
                    }}
                    className="px-3 py-1 border rounded hover:bg-gray-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              // 显示模式
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-2xl">{category.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{category.name}</h3>
                      {!category.is_active && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">已禁用</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{category.description}</p>
                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                      <span>交易信息: {category.post_count}</span>
                      <span>排序: {category.sort_order}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(category.id, category.is_active)}
                    className={`px-3 py-1 rounded text-sm ${
                      category.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.is_active ? '已启用' : '已禁用'}
                  </button>
                  <button
                    onClick={() => setEditingId(category.id)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="编辑"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.name)}
                    className="p-2 hover:bg-red-50 text-red-600 rounded"
                    title="删除"
                    disabled={category.name === '其他分类'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <p className="font-bold mb-2">💡 板块管理说明：</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>建议保持4或6个板块（双数），移动端显示更美观</li>
          <li>"其他分类"板块不能删除，用于存放未分类的交易信息</li>
          <li>删除板块时，该板块下的所有交易信息会自动移至"其他分类"</li>
          <li>禁用板块后，用户端将不会显示该板块，但不影响已有数据</li>
          <li>排序数字越小，板块显示越靠前</li>
        </ul>
      </div>
    </div>
  )
}
