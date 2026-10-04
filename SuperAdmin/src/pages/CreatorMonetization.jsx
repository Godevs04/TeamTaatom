import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import {
  getCreatorProgramSettings,
  saveCreatorProgramSettings,
  listMonetizedCreators,
  getMonetizedCreator,
  setMonetizedCreatorStatus,
  setMonetizedCreatorHold,
  searchMonetizationVideos,
  setVideoMonetizationEligibility,
  listCreatorVerifications,
  reviewCreatorVerification,
  listCreatorWithdrawals,
  actOnCreatorWithdrawal,
  listCreatorAdjustments,
  createCreatorAdjustment,
} from '../services/creatorMonetizationService'

const TABS = ['Settings', 'Creators', 'Videos', 'Verification', 'Withdrawals', 'Adjustments']

const errText = (error, fallback) => error?.response?.data?.message || fallback

export default function CreatorMonetization() {
  const [tab, setTab] = useState('Settings')

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Creator Monetization</h1>
        <p className="text-sm text-gray-500">View-based earnings. Separate from Subscriptions and Video Creators.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${tab === name ? 'bg-sky-700 text-white' : 'border'}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === 'Settings' && <SettingsTab />}
      {tab === 'Creators' && <CreatorsTab />}
      {tab === 'Videos' && <VideosTab />}
      {tab === 'Verification' && <VerificationTab />}
      {tab === 'Withdrawals' && <WithdrawalsTab />}
      {tab === 'Adjustments' && <AdjustmentsTab />}
    </div>
  )
}

function SettingsTab() {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCreatorProgramSettings().then(setForm).catch((error) => toast.error(errText(error, 'Could not load settings')))
  }, [])

  if (!form) return <p className="text-sm text-gray-500">Loading settings…</p>

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    try {
      setSaving(true)
      const saved = await saveCreatorProgramSettings({
        minFollowers: Number(form.minFollowers),
        minVideosPerMonth: Number(form.minVideosPerMonth),
        minEligibleViewsPerMonth: Number(form.minEligibleViewsPerMonth),
        ratePerThousand: Number(form.ratePerThousand),
        minWithdrawal: Number(form.minWithdrawal),
        consecutiveFailMonthsToLock: Number(form.consecutiveFailMonthsToLock),
        qualifyingMonthsToUnlock: Number(form.qualifyingMonthsToUnlock),
        requireTaxIdentity: !!form.requireTaxIdentity,
        paymentMethods: form.paymentMethods,
        policyText: form.policyText,
      })
      setForm(saved)
      toast.success('Settings saved. Creators in the program were notified.')
    } catch (error) {
      toast.error(errText(error, 'Could not save settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Program settings</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <NumberField label="Followers required" value={form.minFollowers} onChange={(value) => set('minFollowers', value)} />
        <NumberField label="Eligible videos per month" value={form.minVideosPerMonth} onChange={(value) => set('minVideosPerMonth', value)} />
        <NumberField label="Eligible views per month" value={form.minEligibleViewsPerMonth} onChange={(value) => set('minEligibleViewsPerMonth', value)} />
        <NumberField label="INR per 1,000 eligible views" value={form.ratePerThousand} onChange={(value) => set('ratePerThousand', value)} />
        <NumberField label="Minimum withdrawal (INR)" value={form.minWithdrawal} onChange={(value) => set('minWithdrawal', value)} />
        <NumberField label="Failing months before lock" value={form.consecutiveFailMonthsToLock} onChange={(value) => set('consecutiveFailMonthsToLock', value)} />
        <NumberField label="Qualifying months to unlock" value={form.qualifyingMonthsToUnlock} onChange={(value) => set('qualifyingMonthsToUnlock', value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.requireTaxIdentity} onChange={(event) => set('requireTaxIdentity', event.target.checked)} />
          Require PAN before withdrawal
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.paymentMethods?.includes('bank')}
            onChange={(event) => set('paymentMethods', event.target.checked ? Array.from(new Set([...(form.paymentMethods || []), 'bank'])) : (form.paymentMethods || []).filter((method) => method !== 'bank'))}
          />
          Bank account
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.paymentMethods?.includes('upi')}
            onChange={(event) => set('paymentMethods', event.target.checked ? Array.from(new Set([...(form.paymentMethods || []), 'upi'])) : (form.paymentMethods || []).filter((method) => method !== 'upi'))}
          />
          UPI
        </label>
        <label className="md:col-span-2 text-sm">
          Policy text
          <textarea className="mt-1 w-full rounded border p-2" rows={8} value={form.policyText || ''} onChange={(event) => set('policyText', event.target.value)} />
        </label>
        <button type="button" disabled={saving} className="rounded bg-sky-700 px-4 py-2 text-sm text-white md:col-span-2" onClick={save}>
          {saving ? 'Saving…' : 'Save and notify creators'}
        </button>
      </CardContent>
    </Card>
  )
}

function CreatorsTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [detail, setDetail] = useState(null)
  const [reason, setReason] = useState('')
  const [reverseAvailable, setReverseAvailable] = useState(false)

  const load = async () => {
    try {
      const result = await listMonetizedCreators({ q, status, page: 1, limit: 30 })
      setRows(result.creators || [])
    } catch (error) {
      toast.error(errText(error, 'Could not load creators'))
    }
  }

  useEffect(() => { load() }, [])

  const open = async (userId) => {
    try {
      setDetail(await getMonetizedCreator(userId))
    } catch (error) {
      toast.error(errText(error, 'Could not load creator'))
    }
  }

  const act = async (nextStatus) => {
    if (!detail?.account?.user) return
    const userId = detail.account.user._id || detail.account.user
    try {
      setDetail(await setMonetizedCreatorStatus(userId, { status: nextStatus, reason, reverseAvailable }))
      setReason('')
      toast.success('Status updated')
      load()
    } catch (error) {
      toast.error(errText(error, 'Could not update status'))
    }
  }

  const hold = async (enabled) => {
    const userId = detail.account.user._id || detail.account.user
    try {
      setDetail(await setMonetizedCreatorHold(userId, { hold: enabled, reason }))
      toast.success(enabled ? 'Withdrawals held' : 'Hold removed')
    } catch (error) {
      toast.error(errText(error, 'Could not update hold'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className="rounded border px-3 py-2 text-sm" placeholder="Username" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="rounded border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {['not_eligible', 'eligible', 'active', 'locked', 'under_review', 'terminated'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={load}>Search</button>
      </div>
      <div className="overflow-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Creator</th>
              <th className="p-2">Status</th>
              <th className="p-2">Followers</th>
              <th className="p-2">Videos</th>
              <th className="p-2">Eligible views</th>
              <th className="p-2">Available</th>
              <th className="p-2">Pending</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="cursor-pointer border-b" onClick={() => open(row.user?._id || row.user)}>
                <td className="p-2">{row.user?.username || 'Unknown'}</td>
                <td className="p-2">{row.status}</td>
                <td className="p-2">{row.gates?.followers ?? '—'}</td>
                <td className="p-2">{row.gates?.videos ?? '—'}</td>
                <td className="p-2">{row.gates?.eligibleViews ?? '—'}</td>
                <td className="p-2">₹{Number(row.availableBalance || 0).toFixed(2)}</td>
                <td className="p-2">₹{Number(row.pendingBalance || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail ? (
        <Card>
          <CardHeader><CardTitle>{detail.account.user?.username}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Status {detail.account.status}. Followers {detail.gates.followers}. Videos this month {detail.gates.videos}. Eligible views {detail.gates.eligibleViews}. Recorded views {detail.gates.monthlyViews}.</p>
            <p>Pending ₹{Number(detail.account.pendingBalance || 0).toFixed(2)} · Available ₹{Number(detail.account.availableBalance || 0).toFixed(2)} · Withdrawn ₹{Number(detail.account.withdrawnTotal || 0).toFixed(2)}</p>
            <textarea className="w-full rounded border p-2" rows={3} placeholder="Reason shown to the creator" value={reason} onChange={(event) => setReason(event.target.value)} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={reverseAvailable} onChange={(event) => setReverseAvailable(event.target.checked)} />
              Reverse available balance when terminating
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded border px-3 py-1" onClick={() => act('under_review')}>Review</button>
              <button type="button" className="rounded border px-3 py-1" onClick={() => act('locked')}>Lock</button>
              <button type="button" className="rounded border px-3 py-1" onClick={() => act('active')}>Unlock</button>
              <button type="button" className="rounded border px-3 py-1" onClick={() => act('terminated')}>Terminate</button>
              <button type="button" className="rounded border px-3 py-1" onClick={() => hold(true)}>Hold withdrawals</button>
              <button type="button" className="rounded border px-3 py-1" onClick={() => hold(false)}>Remove hold</button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function VideosTab() {
  const [q, setQ] = useState('')
  const [videos, setVideos] = useState([])
  const [reason, setReason] = useState('')
  const [voidExisting, setVoidExisting] = useState(true)

  const load = async () => {
    try {
      const result = await searchMonetizationVideos({ q, limit: 20 })
      setVideos(result.videos || [])
    } catch (error) {
      toast.error(errText(error, 'Could not search videos'))
    }
  }

  useEffect(() => { load() }, [])

  const setEligible = async (post, eligible) => {
    try {
      await setVideoMonetizationEligibility(post._id, { eligible, reason, voidExisting: !eligible && voidExisting })
      toast.success(eligible ? 'Video marked eligible' : 'Video excluded')
      load()
    } catch (error) {
      toast.error(errText(error, 'Could not update video'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="rounded border px-3 py-2 text-sm" placeholder="Caption or video id" value={q} onChange={(event) => setQ(event.target.value)} />
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={load}>Search</button>
      </div>
      <textarea className="w-full rounded border p-2 text-sm" rows={2} placeholder="Reason shown to the creator" value={reason} onChange={(event) => setReason(event.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={voidExisting} onChange={(event) => setVoidExisting(event.target.checked)} />
        Void existing eligible views when excluding
      </label>
      <ul className="space-y-2">
        {videos.map((video) => (
          <li key={video._id} className="rounded border bg-white p-3 text-sm">
            <p className="font-medium">{video.caption || video._id}</p>
            <p className="text-gray-500">{video.user?.username} · {video.type} · {video.source || 'upload'} · {video.eligible ? 'eligible' : 'not eligible'}</p>
            {video.monetizationEligibilityReason ? <p>{video.monetizationEligibilityReason}</p> : null}
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded border px-2 py-1" onClick={() => setEligible(video, true)}>Mark eligible</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => setEligible(video, false)}>Exclude</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VerificationTab() {
  const [rows, setRows] = useState([])
  const [note, setNote] = useState('')

  const load = () => {
    listCreatorVerifications()
      .then((result) => setRows(result.verifications || []))
      .catch((error) => toast.error(errText(error, 'Could not load verifications')))
  }

  useEffect(() => { load() }, [])

  const review = async (row, status) => {
    const userId = row.user?._id || row.user
    try {
      await reviewCreatorVerification(userId, { status, note })
      toast.success('Verification updated')
      load()
    } catch (error) {
      toast.error(errText(error, 'Could not update verification'))
    }
  }

  return (
    <div className="space-y-3">
      <textarea className="w-full rounded border p-2 text-sm" rows={2} placeholder="Note for the creator" value={note} onChange={(event) => setNote(event.target.value)} />
      {rows.map((row) => (
        <div key={row._id} className="rounded border bg-white p-3 text-sm">
          <p className="font-medium">{row.user?.username} · {row.verificationStatus}</p>
          <p>Legal name {row.payoutProfile?.legalName} · {row.payoutProfile?.method}</p>
          <p>Account {row.payoutProfile?.bankAccountNumber || '—'} · IFSC {row.payoutProfile?.bankIfsc || '—'} · UPI {row.payoutProfile?.upiId || '—'}</p>
          <p>PAN {row.payoutProfile?.taxId || '—'}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded border px-2 py-1" onClick={() => review(row, 'verified')}>Approve</button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => review(row, 'rejected')}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function WithdrawalsTab() {
  const [rows, setRows] = useState([])
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')

  const load = () => {
    listCreatorWithdrawals()
      .then((result) => setRows(result.withdrawals || []))
      .catch((error) => toast.error(errText(error, 'Could not load withdrawals')))
  }

  useEffect(() => { load() }, [])

  const act = async (row, action) => {
    try {
      await actOnCreatorWithdrawal(row._id, { action, reason, payoutReference: reference })
      toast.success('Withdrawal updated')
      load()
    } catch (error) {
      toast.error(errText(error, 'Could not update withdrawal'))
    }
  }

  return (
    <div className="space-y-3">
      <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Hold or rejection reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      <input className="w-full rounded border px-3 py-2 text-sm" placeholder="UTR or UPI reference" value={reference} onChange={(event) => setReference(event.target.value)} />
      {rows.map((row) => (
        <div key={row._id} className="rounded border bg-white p-3 text-sm">
          <p className="font-medium">{row.user?.username} · ₹{Number(row.amount).toFixed(2)} · {row.method} · {row.status}</p>
          <p>{row.destinationSnapshot?.legalName} · {row.destinationSnapshot?.bankAccountNumber || row.destinationSnapshot?.upiId}</p>
          {row.payoutReference ? <p>Reference {row.payoutReference}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rounded border px-2 py-1" onClick={() => act(row, 'hold')}>Hold</button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => act(row, 'processing')}>Processing</button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => act(row, 'reject')}>Reject</button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => act(row, 'paid')}>Mark paid</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AdjustmentsTab() {
  const [form, setForm] = useState({
    userId: '',
    monthKey: '',
    eligibleViewsDelta: 0,
    amountDelta: 0,
    target: 'available',
    reason: '',
  })
  const [rows, setRows] = useState([])

  const load = () => {
    listCreatorAdjustments()
      .then((result) => setRows(result.adjustments || []))
      .catch((error) => toast.error(errText(error, 'Could not load adjustments')))
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    try {
      await createCreatorAdjustment({
        ...form,
        eligibleViewsDelta: Number(form.eligibleViewsDelta),
        amountDelta: Number(form.amountDelta),
      })
      toast.success('Adjustment saved')
      setForm((current) => ({ ...current, reason: '' }))
      load()
    } catch (error) {
      toast.error(errText(error, 'Could not save adjustment'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded border px-3 py-2 text-sm" placeholder="User id" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Month YYYY-MM (optional)" value={form.monthKey} onChange={(event) => setForm({ ...form, monthKey: event.target.value })} />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Eligible views delta" value={form.eligibleViewsDelta} onChange={(event) => setForm({ ...form, eligibleViewsDelta: event.target.value })} />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Rupee delta" value={form.amountDelta} onChange={(event) => setForm({ ...form, amountDelta: event.target.value })} />
        <select className="rounded border px-3 py-2 text-sm" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })}>
          <option value="available">Available balance</option>
          <option value="pending">Pending earnings</option>
        </select>
        <input className="rounded border px-3 py-2 text-sm" placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </div>
      <button type="button" className="rounded bg-sky-700 px-4 py-2 text-sm text-white" onClick={submit}>Save adjustment</button>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row._id} className="rounded border bg-white p-3">
            {row.user?.username || row.user} · {row.target} · views {row.eligibleViewsDelta} · ₹{Number(row.amountDelta).toFixed(2)} · {row.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="text-sm">
      {label}
      <input className="mt-1 w-full rounded border px-3 py-2" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
