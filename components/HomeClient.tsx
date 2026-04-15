'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, Task, Member } from '@/lib/supabase'

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
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
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
    setAuthError('')
    setAuthTip('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(error.message)
    }
  }

  const handleSignUp = async () => {
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
    await supabase.auth.signOut()
    setUser(null)
    setTasks([])
  }

  // 看板操作
  const startAdd = async (status: Task['status']) => {
    if (!user) return
    const val = window.prompt('要做什么事？')
    if (!val || !val.trim()) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        content: val.trim(),
        status,
        assignee_ids: [],
        created_by: user.id,
      })
      .select()
      .single()
    if (!error && data) {
      setTasks(prev => [data, ...prev])
    }
  }

  const updateTaskContent = async (task: Task, newContent: string) => {
    if (!newContent.trim() || newContent.trim() === task.content) return
    await supabase.from('tasks').update({ content: newContent.trim() }).eq('id', task.id)
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, content: newContent.trim() } : t)))
  }

  const toggleAssignee = async (task: Task, memberId: string) => {
    const ids = Array.isArray(task.assignee_ids) ? [...task.assignee_ids] : []
    const idx = ids.indexOf(memberId)
    if (idx > -1) ids.splice(idx, 1)
    else ids.push(memberId)
    const { error } = await supabase.from('tasks').update({ assignee_ids: ids }).eq('id', task.id)
    if (!error) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, assignee_ids: ids } : t)))
    }
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const dropTask = async (e: React.DragEvent, status: Task['status']) => {
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
      if (filterMemberId) {
        const ids = t.assignee_ids || []
        return ids.includes(filterMemberId)
      }
      return true
    })
  }, [tasks, filterMemberId])

  if (!mounted || loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: '1.2rem' }}>loading...</div>
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
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="******"
            onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
          />
          <span
            onClick={() => setShowPassword(v => !v)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              userSelect: 'none',
            }}
            title={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? '🙈' : '👁'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button onClick={handleLogin} style={{ flex: 1 }}>登录</button>
          <button
            onClick={handleSignUp}
            style={{ flex: 1, background: '#fff', color: '#1a1a1a' }}
          >
            注册
          </button>
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
      <header>
        <h1>mirako</h1>
        <div className="header-right">
          <div className="members">
            {members.map(m => {
              const isMe = m.id === user.id
              const hasNotif = isMe && hasNewAssignment(m.id)
              return (
                <div
                  key={m.id}
                  className={`member-avatar sketch-box ${filterMemberId === m.id ? 'active' : ''}`}
                  title={m.name + (isMe ? ' (我)' : '')}
                  onClick={() => setFilterMemberId(prev => prev === m.id ? null : m.id)}
                >
                  {m.abbr}
                  {hasNotif && <span className="notif-badge">!</span>}
                </div>
              )
            })}
            {filterMemberId && (
              <span className="clear-filter" onClick={() => setFilterMemberId(null)}>
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
                      onUpdateContent={updateTaskContent}
                      onToggleAssignee={toggleAssignee}
                      onDelete={deleteTask}
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
  onUpdateContent,
  onToggleAssignee,
  onDelete,
}: {
  task: Task
  members: Member[]
  onUpdateContent: (task: Task, val: string) => void
  onToggleAssignee: (task: Task, memberId: string) => void
  onDelete: (id: string) => void
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
      <div className="task-meta">
        <div className="task-assignees">
          {members.map(m => {
            const ids = task.assignee_ids || []
            return (
              <span
                key={m.id}
                className={`mini-avatar ${ids.includes(m.id) ? 'assigned' : ''}`}
                title={'指派给 ' + m.name}
                onClick={e => { e.stopPropagation(); onToggleAssignee(task, m.id) }}
              >
                {m.abbr}
              </span>
            )
          })}
        </div>
        <span className="task-delete" onClick={e => { e.stopPropagation(); onDelete(task.id) }}>
          ×
        </span>
      </div>
    </div>
  )
}
