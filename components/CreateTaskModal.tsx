import { useEffect, useMemo, useRef, useState } from 'react'
import type { Member, Task } from '@/lib/supabase'

export default function CreateTaskModal({
  open,
  status,
  members,
  unavailableMemberIds,
  defaultAssigneeIds,
  onClose,
  onCreate,
}: {
  open: boolean
  status: Task['status']
  members: Member[]
  unavailableMemberIds: Set<string>
  defaultAssigneeIds?: string[]
  onClose: () => void
  onCreate: (payload: { content: string; assigneeIds: string[]; status: Task['status'] }) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(defaultAssigneeIds ?? [])
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setContent('')
    setAssigneeIds((defaultAssigneeIds || []).filter(id => !unavailableMemberIds.has(id)))
    setSubmitting(false)
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open, defaultAssigneeIds, unavailableMemberIds])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const statusLabel = useMemo(() => {
    if (status === 'todo') return '待办'
    if (status === 'doing') return '进行中'
    return '已完成'
  }, [status])

  if (!open) return null

  const submit = async () => {
    const trimmed = content.trim()
    if (!trimmed || submitting) return
    const validAssigneeIds = assigneeIds.filter(id => !unavailableMemberIds.has(id))
    setSubmitting(true)
    try {
      await onCreate({ content: trimmed, assigneeIds: validAssigneeIds, status })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMember = (memberId: string) => {
    if (unavailableMemberIds.has(memberId)) return
    setAssigneeIds(prev => (
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    ))
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div className="modal sketch-box" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-title">
          新建任务 <span className="modal-sub">（{statusLabel}）</span>
        </div>

        <label className="modal-label">任务名</label>
        <input
          ref={inputRef}
          className="modal-input"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="例如：整理需求、修复登录、写周报…"
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
        />

        <label className="modal-label">任务人</label>
        <div className="modal-member-grid">
          {members.map(m => (
            <button
              key={m.id}
              type="button"
              className={`modal-member-chip ${assigneeIds.includes(m.id) ? 'selected' : ''} ${unavailableMemberIds.has(m.id) ? 'disabled' : ''}`}
              onClick={() => toggleMember(m.id)}
              disabled={unavailableMemberIds.has(m.id)}
            >
              {m.name}{unavailableMemberIds.has(m.id) ? '（已建好）' : ''}
            </button>
          ))}
        </div>
        <div className="modal-tip">
          {assigneeIds.length ? `已选择 ${assigneeIds.length} 人` : '可不选，也可多选'}
        </div>

        <div className="modal-actions">
          <button className="modal-btn outline" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button className="modal-btn" onClick={submit} disabled={submitting || !content.trim()}>
            {submitting ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

