'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseMissing, Task, Member } from '@/lib/supabase'
import CreateTaskModal from '@/components/CreateTaskModal'

const DEFAULT_MEMBERS: Member[] = [
  { id: 'peter',    name: 'Peter',    abbr: 'P' },
  { id: 'tamikip',  name: 'TamikiP',  abbr: 'T' },
  { id: 'luochuan', name: '落川',     abbr: '落' },
  { id: 'xiaokeng', name: '小坑酱',   abbr: '坑' },
]

type User = {
  id: string
  email?: string
}

export default function HomeClient() {
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 登录表单
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authTip, setAuthTip] = useState('')

  // 看板数据
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS)
  const [tasks, setTasks] = useState<Task[]>([])
  const [filterMemberIds, setFilterMemberIds] = useState<string[]>([])
  const channelRef = useRef<any>(null)

  // 创建任务弹窗
  const [createOpen, setCreateOpen] = useState(false)
  const [createStatus, setCreateStatus] = useState<Task['status']>('todo')
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const defaultAssigneeIds = filterMemberIds
  const completedMemberIds = useMemo(() => {
    const ids = new Set<string>()
    tasks.forEach(task => {
      if (task.status !== 'done') return
      ;(task.assignee_ids || []).forEach(id => ids.add(id))
    })
    return ids
  }, [tasks])
  const createDefaultAssigneeIds = defaultAssigneeIds.filter(id => !completedMemberIds.has(id))

  useEffect(() => {
    setMounted(true)

    if (supabaseMissing) {
      setLoading(false)
      return
    }

    const init = async () => {
      const res = await supabase.auth.getSession()
      const s = res.data.session
      if (s?.user) {
        setUser({ id: s.user.id, email: s.user.email })
      }
      setLoading(false)
    }
    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
      } else {
        setUser(null)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // 用户登录后加载数据
  useEffect(() => {
    if (supabaseMissing) return
    if (!user) {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      return
    }

    let mounted = true
    const load = async () => {
      // load members
      const { data: mData, error: mErr } = await supabase
        .from('profiles')
        .select('*')
        .order('name')
      if (!mounted) return
      if (!mErr && mData && mData.length) {
        setMembers(mData.map((p: any) => ({ id: p.id, name: p.name, abbr: p.abbr })))
      }

      // load tasks
      const { data: tData, error: tErr } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (!mounted) return
      if (!tErr) {
        setTasks(tData || [])
      }

      // realtime
      if (channelRef.current) channelRef.current.unsubscribe()
      channelRef.current = supabase
        .channel('public:tasks')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload: any) => {
            setTasks(prev => {
              if (payload.eventType === 'INSERT') {
                return [payload.new, ...prev]
              }
              if (payload.eventType === 'UPDATE') {
                return prev.map(t => (t.id === payload.new.id ? payload.new : t))
              }
              if (payload.eventType === 'DELETE') {
                return prev.filter(t => t.id !== payload.old.id)
              }
              return prev
            })
          }
        )
        .subscribe()
    }

    load()

    return () => {
      mounted = false
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [user])

  const handleLogin = async () => {
    if (supabaseMissing) return
    setAuthError('')
    setAuthTip('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(error.message)
    }
  }

  const handleSignUp = async () => {
    if (supabaseMissing) return
    setAuthError('')
    setAuthTip('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setAuthError(error.message)
    } else {
      setAuthTip('注册成功！如果开启了邮箱验证，请去邮箱点击确认链接后再登录。')
    }
  }

  const handleLogout = async () => {
    if (supabaseMissing) return
    await supabase.auth.signOut()
    setUser(null)
    setTasks([])
  }

  // 看板操作
  const startAdd = (status: Task['status']) => {
    if (!user) return
    setCreateStatus(status)
    setCreateOpen(true)
  }

  const createTask = async (payload: { content: string; assigneeIds: string[]; status: Task['status'] }) => {
    if (!user || supabaseMissing) return
    const assignee_ids = payload.assigneeIds.filter(id => !completedMemberIds.has(id))
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        content: payload.content,
        status: payload.status,
        assignee_ids,
        created_by: user.id,
      })
      .select()
      .single()
    if (!error && data) {
      setTasks(prev => [data, ...prev])
    }
  }

  const updateTaskContent = async (task: Task, newContent: string) => {
    if (supabaseMissing) return
    if (!newContent.trim() || newContent.trim() === task.content) return
    await supabase.from('tasks').update({ content: newContent.trim() }).eq('id', task.id)
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, content: newContent.trim() } : t)))
  }

  const toggleAssignee = async (task: Task, memberId: string) => {
    if (supabaseMissing) return
    const ids = Array.isArray(task.assignee_ids) ? [...task.assignee_ids] : []
    const idx = ids.indexOf(memberId)
    if (idx > -1) ids.splice(idx, 1)
    else {
      if (completedMemberIds.has(memberId)) return
      ids.push(memberId)
    }
    const { error } = await supabase.from('tasks').update({ assignee_ids: ids }).eq('id', task.id)
    if (!error) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, assignee_ids: ids } : t)))
    }
  }

  const deleteTask = async () => {
    if (supabaseMissing) return
    if (!deleteTarget) return
    const id = deleteTarget.id
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setDeleteTarget(null)
  }

  const advanceTask = async (task: Task) => {
    if (supabaseMissing) return
    const nextStatus =
      task.status === 'todo' ? 'doing' :
      task.status === 'doing' ? 'done' :
      null
    if (!nextStatus) return
    const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id)
    if (!error) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    }
  }

  const dropTask = async (e: React.DragEvent, status: Task['status']) => {
    if (supabaseMissing) return
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    const task = tasks.find(t => t.id === id)
    if (task && task.status !== status) {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
      if (!error) {
        setTasks(prev => prev.map(t => (t.id === id ? { ...t, status } : t)))
      }
    }
  }

  const hasNewAssignment = (memberId: string) => {
    return tasks.some(t => {
      const ids = t.assignee_ids || []
      return ids.includes(memberId) && t.status !== 'done'
    })
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterMemberIds.length) {
        const ids = t.assignee_ids || []
        return filterMemberIds.some(mid => ids.includes(mid))
      }
      return true
    })
  }, [tasks, filterMemberIds])

  if (!mounted || loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: '1.2rem' }}>loading...</div>
  }

  if (supabaseMissing) {
    return (
      <div className="login-wrap sketch-box">
        <h1>mirako</h1>
        <div className="login-error" style={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
          ⚠️ Supabase 环境变量未配置<br />
          请在 Vercel Dashboard → Project Settings → Environment Variables 中添加以下两项：
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
            <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
          </ul>
          添加后重新部署即可。
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="login-wrap sketch-box">
        <h1>mirako</h1>
        <label>邮箱</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <label>密码</label>
        <div className="password-wrap">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="******"
            onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
          />
          <span
            className="eye-toggle"
            onClick={() => setShowPassword(v => !v)}
            title={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? '🙈' : '👁'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button className="login-btn" onClick={handleLogin}>登录</button>
          <button className="login-btn outline" onClick={handleSignUp}>注册</button>
        </div>
        <div className="login-tip">
          小团队自用看板。如果是第一次使用，输入邮箱密码点击注册即可。
          <br />
          若 Supabase 开启了邮箱验证，注册后需要去邮箱点确认链接。
        </div>
        {authError && <div className="login-error">{authError}</div>}
        {authTip && <div className="login-error" style={{ color: '#060' }}>{authTip}</div>}
      </div>
    )
  }

  return (
    <div className="container">
      <CreateTaskModal
        open={createOpen}
        status={createStatus}
        members={members}
        unavailableMemberIds={completedMemberIds}
        defaultAssigneeIds={createDefaultAssigneeIds}
        onClose={() => setCreateOpen(false)}
        onCreate={createTask}
      />
      <DeleteConfirmModal
        task={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTask}
      />
      <header>
        <h1>mirako</h1>
        <div className="header-right">
          <div className="members">
            {members.map(m => {
              const isMe = m.id === user.id
              const hasNotif = isMe && hasNewAssignment(m.id)
              const active = filterMemberIds.includes(m.id)
              return (
                <div
                  key={m.id}
                  className={`member-avatar sketch-box ${active ? 'active' : ''}`}
                  title={
                    (active ? '（筛选中）' : '') +
                    m.name +
                    (isMe ? ' (我)' : '') +
                    '（点击切换筛选）'
                  }
                  onClick={() =>
                    setFilterMemberIds(prev => {
                      if (prev.includes(m.id)) return prev.filter(x => x !== m.id)
                      return [...prev, m.id]
                    })
                  }
                >
                  {m.name}
                  {hasNotif && <span className="notif-badge">!</span>}
                </div>
              )
            })}
            {filterMemberIds.length > 0 && (
              <span className="clear-filter" onClick={() => setFilterMemberIds([])}>
                清除筛选
              </span>
            )}
          </div>
          <button className="logout-btn" onClick={handleLogout}>退出</button>
        </div>
      </header>

      <div className="board">
        {(['todo', 'doing', 'done'] as const).map(status => {
          const list = filteredTasks.filter(t => t.status === status)
          return (
            <div
              key={status}
              className={`column ${status === 'doing' ? 'sketch-box-alt' : 'sketch-box'}`}
              data-status={status}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={e => dropTask(e, status)}
            >
              <h2 className="col-title">
                {status === 'todo' ? '待办' : status === 'doing' ? '进行中' : '已完成'}
                <span className="col-count">{list.length}</span>
              </h2>
              <div className="task-list">
                {list.length === 0 ? (
                  <div className="empty-hint">— 暂无任务 —</div>
                ) : (
                  list.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      members={members}
                      unavailableMemberIds={completedMemberIds}
                      onAdvance={advanceTask}
                      onUpdateContent={updateTaskContent}
                      onToggleAssignee={toggleAssignee}
                      onDelete={setDeleteTarget}
                    />
                  ))
                )}
              </div>
              <button className="add-btn" onClick={() => startAdd(status)}>+ 新建任务</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskCard({
  task,
  members,
  unavailableMemberIds,
  onAdvance,
  onUpdateContent,
  onToggleAssignee,
  onDelete,
}: {
  task: Task
  members: Member[]
  unavailableMemberIds: Set<string>
  onAdvance: (task: Task) => void
  onUpdateContent: (task: Task, val: string) => void
  onToggleAssignee: (task: Task, memberId: string) => void
  onDelete: (task: Task) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.content)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    onUpdateContent(task, draft)
  }

  return (
    <div
      className="task-card sketch-box"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', task.id)
        e.currentTarget.classList.add('dragging')
      }}
      onDragEnd={e => {
        e.currentTarget.classList.remove('dragging')
      }}
    >
      <div className="task-title-row">
        <div
          ref={ref}
          className="task-text"
          contentEditable={editing}
          suppressContentEditableWarning
          onClick={() => { if (!editing) setEditing(true) }}
          onInput={e => setDraft(e.currentTarget.textContent || '')}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(task.content); setEditing(false) }
          }}
          style={editing ? { borderBottom: '1px dashed #555', background: 'rgba(0,0,0,0.02)' } : undefined}
        >
          {task.content}
        </div>
        {task.status !== 'done' ? (
          <button
            type="button"
            className="task-advance"
            title={task.status === 'todo' ? '移到进行中' : '移到已完成'}
            onClick={e => {
              e.stopPropagation()
              onAdvance(task)
            }}
          >
            {task.status === 'todo' ? '到进行中' : '到已完成'}
          </button>
        ) : null}
      </div>
      <div className="task-meta">
        <div className="task-assignees">
          {members.map(m => {
            const ids = task.assignee_ids || []
            const assigned = ids.includes(m.id)
            const disabled = unavailableMemberIds.has(m.id) && !assigned
            return (
              <span
                key={m.id}
                className={`mini-avatar ${assigned ? 'assigned' : ''} ${disabled ? 'disabled' : ''}`}
                title={
                  disabled
                    ? `${m.name} 已建好，不能再指派`
                    : assigned
                      ? `${m.name}（点击取消指派）`
                      : `指派给 ${m.name}`
                }
                onClick={e => {
                  e.stopPropagation()
                  if (disabled) return
                  onToggleAssignee(task, m.id)
                }}
              >
                {m.name}
              </span>
            )
          })}
        </div>
        <span className="task-delete" onClick={e => { e.stopPropagation(); onDelete(task) }}>
          ×
        </span>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task | null
  onClose: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    if (!task) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [task, onClose])

  if (!task) return null

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div className="modal sketch-box delete-modal" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-title">确认删除</div>
        <div className="delete-modal-text">
          确定要删除这个任务吗？
        </div>
        <div className="delete-modal-task">“{task.content}”</div>
        <div className="modal-actions">
          <button className="modal-btn outline" onClick={onClose}>
            取消
          </button>
          <button className="modal-btn danger" onClick={onConfirm}>
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
