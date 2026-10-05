import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  BadgeIndianRupee,
  Clapperboard,
  Eye,
  Lock,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wallet,
} from 'lucide-react'
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

const TABS = [
  { id: 'Settings', icon: Settings2 },
  { id: 'Creators', icon: Users },
  { id: 'Videos', icon: Clapperboard },
  { id: 'Verification', icon: ShieldCheck },
  { id: 'Withdrawals', icon: Wallet },
  { id: 'Adjustments', icon: SlidersHorizontal },
]

const STATUS_STYLE = {
  not_eligible: 'bg-slate-100 text-slate-600',
  eligible: 'bg-sky-50 text-sky-700',
  active: 'bg-emerald-50 text-emerald-700',
  locked: 'bg-amber-50 text-amber-800',
  under_review: 'bg-orange-50 text-orange-700',
  terminated: 'bg-red-50 text-red-700',
  requested: 'bg-sky-50 text-sky-700',
  on_hold: 'bg-amber-50 text-amber-800',
  processing: 'bg-indigo-50 text-indigo-700',
  paid: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  pending: 'bg-amber-50 text-amber-800',
  verified: 'bg-emerald-50 text-emerald-700',
  none: 'bg-slate-100 text-slate-600',
}

const fieldClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500'

const errText = (error, fallback) => error?.response?.data?.message || fallback
const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const labelize = (value) => String(value || '—').replace(/_/g, ' ')

function Badge({ value }) {
  const key = String(value || '').toLowerCase()
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[key] || 'bg-slate-100 text-slate-600'}`}>
      {labelize(value)}
    </span>
  )
}

function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{children}</p>
}

export default function CreatorMonetization() {
  const [tab, setTab] = useState('Settings')

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sky-100">Creator program</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <Wallet className="h-6 w-6" />
              Creator Monetization
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-sky-100">
              View-based earnings on a creator’s own account. This stays separate from Connect subscriptions and Video Creators.
            </p>
          </div>
          <BadgeIndianRupee className="hidden h-14 w-14 text-white/30 sm:block" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === id
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setTab(id)}
          >
            <Icon className="h-4 w-4" />
            {id}
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
  const toggleMethod = (method, enabled) => {
    const current = form.paymentMethods || []
    set('paymentMethods', enabled ? Array.from(new Set([...current, method])) : current.filter((item) => item !== method))
  }

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="sky" icon={Users} label="Followers" value={form.minFollowers} hint="to qualify" />
        <Stat tone="violet" icon={Clapperboard} label="Videos / month" value={form.minVideosPerMonth} hint="shorts and long videos" />
        <Stat tone="emerald" icon={Eye} label="Eligible views" value={Number(form.minEligibleViewsPerMonth || 0).toLocaleString('en-IN')} hint="the earnings gate" />
        <Stat tone="amber" icon={BadgeIndianRupee} label="Rate / 1,000" value={inr(form.ratePerThousand)} hint={`Min withdrawal ${inr(form.minWithdrawal)}`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Program settings</CardTitle>
          <p className="text-sm text-gray-500">Saving notifies creators who are eligible, active, locked, or under review.</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberField label="Followers required" value={form.minFollowers} onChange={(value) => set('minFollowers', value)} />
          <NumberField label="Eligible videos per month" value={form.minVideosPerMonth} onChange={(value) => set('minVideosPerMonth', value)} />
          <NumberField label="Eligible views per month" value={form.minEligibleViewsPerMonth} onChange={(value) => set('minEligibleViewsPerMonth', value)} />
          <NumberField label="INR per 1,000 eligible views" value={form.ratePerThousand} onChange={(value) => set('ratePerThousand', value)} />
          <NumberField label="Minimum withdrawal (INR)" value={form.minWithdrawal} onChange={(value) => set('minWithdrawal', value)} />
          <NumberField label="Failing months before lock" value={form.consecutiveFailMonthsToLock} onChange={(value) => set('consecutiveFailMonthsToLock', value)} />
          <NumberField label="Qualifying months to unlock" value={form.qualifyingMonthsToUnlock} onChange={(value) => set('qualifyingMonthsToUnlock', value)} />
          <div className="flex flex-col justify-end gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!form.requireTaxIdentity} onChange={(event) => set('requireTaxIdentity', event.target.checked)} />
              Require PAN before withdrawal
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.paymentMethods?.includes('bank')} onChange={(event) => toggleMethod('bank', event.target.checked)} />
              Bank account
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.paymentMethods?.includes('upi')} onChange={(event) => toggleMethod('upi', event.target.checked)} />
              UPI
            </label>
          </div>
          <label className="text-sm md:col-span-2">
            <span className="font-medium text-gray-700">Policy text</span>
            <textarea className={`${fieldClass} mt-1`} rows={8} value={form.policyText || ''} onChange={(event) => set('policyText', event.target.value)} />
          </label>
          <button type="button" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 md:col-span-2" onClick={save}>
            {saving ? 'Saving…' : 'Save and notify creators'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

function CreatorsTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [detail, setDetail] = useState(null)
  const [reason, setReason] = useState('')
  const [reverseAvailable, setReverseAvailable] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const result = await listMonetizedCreators({ q, status, page: 1, limit: 30 })
      setRows(result.creators || [])
    } catch (error) {
      toast.error(errText(error, 'Could not load creators'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totals = useMemo(() => ({
    available: rows.reduce((sum, row) => sum + Number(row.availableBalance || 0), 0),
    pending: rows.reduce((sum, row) => sum + Number(row.pendingBalance || 0), 0),
    active: rows.filter((row) => row.status === 'active').length,
  }), [rows])

  const open = async (userId) => {
    try {
      setDetail(await getMonetizedCreator(userId))
      setReason('')
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
      <div className="grid grid-cols-3 gap-3">
        <Stat tone="sky" icon={Users} label="Listed" value={rows.length} />
        <Stat tone="emerald" icon={Wallet} label="Available" value={inr(totals.available)} />
        <Stat tone="amber" icon={BadgeIndianRupee} label="Pending" value={inr(totals.pending)} hint={`${totals.active} active on this page`} />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Creators</CardTitle>
            <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); load() }}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input className={`${fieldClass} w-44 pl-8`} placeholder="Username" value={q} onChange={(event) => setQ(event.target.value)} />
              </div>
              <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {['not_eligible', 'eligible', 'active', 'locked', 'under_review', 'terminated'].map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
              </select>
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Search
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {['Creator', 'Status', 'Followers', 'Videos', 'Eligible views', 'Available', 'Pending'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No creators yet. An account appears after someone opens the dashboard.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="cursor-pointer border-t hover:bg-sky-50/60" onClick={() => open(row.user?._id || row.user)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {(row.user?.username || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium">{row.user?.username || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge value={row.status} /></td>
                  <td className="px-4 py-3">{row.gates?.followers ?? '—'}</td>
                  <td className="px-4 py-3">{row.gates?.videos ?? '—'}</td>
                  <td className="px-4 py-3">{row.gates?.eligibleViews ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{inr(row.availableBalance)}</td>
                  <td className="px-4 py-3">{inr(row.pendingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {detail ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>@{detail.account.user?.username}</CardTitle>
              <Badge value={detail.account.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Mini label="Followers" value={detail.gates.followers} />
              <Mini label="Videos" value={detail.gates.videos} />
              <Mini label="Eligible views" value={detail.gates.eligibleViews} />
              <Mini label="Recorded views" value={detail.gates.monthlyViews} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Mini label="Pending" value={inr(detail.account.pendingBalance)} />
              <Mini label="Available" value={inr(detail.account.availableBalance)} />
              <Mini label="Withdrawn" value={inr(detail.account.withdrawnTotal)} />
            </div>
            <textarea className={fieldClass} rows={3} placeholder="Reason shown to the creator" value={reason} onChange={(event) => setReason(event.target.value)} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={reverseAvailable} onChange={(event) => setReverseAvailable(event.target.checked)} />
              Reverse available balance when terminating
            </label>
            <div className="flex flex-wrap gap-2">
              <Action onClick={() => act('under_review')}>Review</Action>
              <Action onClick={() => act('locked')} tone="amber"><Lock className="h-3.5 w-3.5" /> Lock</Action>
              <Action onClick={() => act('active')} tone="green">Unlock</Action>
              <Action onClick={() => act('terminated')} tone="red">Terminate</Action>
              <Action onClick={() => hold(true)}>Hold withdrawals</Action>
              <Action onClick={() => hold(false)}>Remove hold</Action>
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
      <Card>
        <CardContent className="space-y-3 pt-6">
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load() }}>
            <input className={fieldClass} placeholder="Caption or video id" value={q} onChange={(event) => setQ(event.target.value)} />
            <button type="submit" className="rounded-lg border px-4 text-sm font-semibold hover:bg-gray-50">Search</button>
          </form>
          <textarea className={fieldClass} rows={2} placeholder="Reason shown to the creator" value={reason} onChange={(event) => setReason(event.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={voidExisting} onChange={(event) => setVoidExisting(event.target.checked)} />
            Void existing eligible views when excluding
          </label>
        </CardContent>
      </Card>
      {videos.length === 0 ? <Empty>No shorts or long videos found.</Empty> : (
        <ul className="space-y-2">
          {videos.map((video) => (
            <li key={video._id} className="rounded-xl border bg-white p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{video.caption || video._id}</p>
                  <p className="mt-1 text-gray-500">{video.user?.username || 'Unknown'} · {labelize(video.type)} · {video.source || 'upload'}</p>
                  {video.monetizationEligibilityReason ? <p className="mt-1 text-amber-700">{video.monetizationEligibilityReason}</p> : null}
                </div>
                <Badge value={video.eligible ? 'eligible' : 'not_eligible'} />
              </div>
              <div className="mt-3 flex gap-2">
                <Action onClick={() => setEligible(video, true)} tone="green">Mark eligible</Action>
                <Action onClick={() => setEligible(video, false)} tone="red">Exclude</Action>
              </div>
            </li>
          ))}
        </ul>
      )}
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
      <Card>
        <CardContent className="pt-6">
          <textarea className={fieldClass} rows={2} placeholder="Note for the creator" value={note} onChange={(event) => setNote(event.target.value)} />
        </CardContent>
      </Card>
      {rows.length === 0 ? <Empty>No payout profiles waiting for review.</Empty> : rows.map((row) => (
        <div key={row._id} className="rounded-xl border bg-white p-4 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{row.user?.username}</p>
            <Badge value={row.verificationStatus} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Mini label="Legal name" value={row.payoutProfile?.legalName || '—'} />
            <Mini label="Method" value={labelize(row.payoutProfile?.method)} />
            <Mini label="Account" value={row.payoutProfile?.bankAccountNumber || '—'} />
            <Mini label="IFSC" value={row.payoutProfile?.bankIfsc || '—'} />
            <Mini label="Bank" value={[row.payoutProfile?.bankName, row.payoutProfile?.bankBranch, row.payoutProfile?.bankCity].filter(Boolean).join(' · ') || '—'} />
            <Mini label="UPI" value={row.payoutProfile?.upiId || '—'} />
            <Mini label="PAN" value={row.payoutProfile?.taxId || '—'} />
          </div>
          <div className="mt-3 flex gap-2">
            <Action onClick={() => review(row, 'verified')} tone="green">Approve</Action>
            <Action onClick={() => review(row, 'rejected')} tone="red">Reject</Action>
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
  const [status, setStatus] = useState('')

  const load = (nextStatus = status) => {
    listCreatorWithdrawals(nextStatus)
      .then((result) => setRows(result.withdrawals || []))
      .catch((error) => toast.error(errText(error, 'Could not load withdrawals')))
  }

  useEffect(() => { load('') }, [])

  const act = async (row, action) => {
    try {
      await actOnCreatorWithdrawal(row._id, { action, reason, payoutReference: reference })
      toast.success('Withdrawal updated')
      load()
    } catch (error) {
      toast.error(errText(error, 'Could not update withdrawal'))
    }
  }

  const waiting = rows.filter((row) => row.status === 'requested' || row.status === 'processing' || row.status === 'on_hold')
  const amountDue = waiting.reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat tone="sky" icon={Wallet} label="Open requests" value={waiting.length} />
        <Stat tone="amber" icon={BadgeIndianRupee} label="Amount in queue" value={inr(amountDue)} />
      </div>
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-3">
          <input className={fieldClass} placeholder="Hold or rejection reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <input className={fieldClass} placeholder="UTR or UPI reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          <select className={fieldClass} value={status} onChange={(event) => { setStatus(event.target.value); load(event.target.value) }}>
            <option value="">All withdrawals</option>
            {['requested', 'on_hold', 'processing', 'paid', 'rejected'].map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
          </select>
        </CardContent>
      </Card>
      {rows.length === 0 ? <Empty>No withdrawals in this view.</Empty> : rows.map((row) => (
        <div key={row._id} className="rounded-xl border bg-white p-4 text-sm shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{row.user?.username} · {inr(row.amount)}</p>
            <Badge value={row.status} />
          </div>
          <p className="mt-2 text-gray-500">{labelize(row.method)} · {row.destinationSnapshot?.legalName} · {row.destinationSnapshot?.bankAccountNumber || row.destinationSnapshot?.upiId || '—'}</p>
          {row.destinationSnapshot?.bankIfsc ? <p className="text-gray-500">IFSC {row.destinationSnapshot.bankIfsc}{row.destinationSnapshot.bankName ? ` · ${row.destinationSnapshot.bankName}` : ''}{row.destinationSnapshot.bankBranch ? ` · ${row.destinationSnapshot.bankBranch}` : ''}</p> : null}
          {row.payoutReference ? <p className="mt-1">Reference {row.payoutReference}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Action onClick={() => act(row, 'hold')}>Hold</Action>
            <Action onClick={() => act(row, 'processing')}>Processing</Action>
            <Action onClick={() => act(row, 'reject')} tone="red">Reject</Action>
            <Action onClick={() => act(row, 'paid')} tone="green">Mark paid</Action>
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
      <Card>
        <CardHeader><CardTitle>Adjust earnings or views</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <input className={fieldClass} placeholder="User id" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} />
          <input className={fieldClass} placeholder="Month YYYY-MM (optional)" value={form.monthKey} onChange={(event) => setForm({ ...form, monthKey: event.target.value })} />
          <input className={fieldClass} placeholder="Eligible views delta" value={form.eligibleViewsDelta} onChange={(event) => setForm({ ...form, eligibleViewsDelta: event.target.value })} />
          <input className={fieldClass} placeholder="Rupee delta" value={form.amountDelta} onChange={(event) => setForm({ ...form, amountDelta: event.target.value })} />
          <select className={fieldClass} value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })}>
            <option value="available">Available balance</option>
            <option value="pending">Pending earnings</option>
          </select>
          <input className={fieldClass} placeholder="Reason shown to the creator" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 md:col-span-2" onClick={submit}>Save adjustment</button>
        </CardContent>
      </Card>
      {rows.length === 0 ? <Empty>No adjustments yet.</Empty> : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row._id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{row.user?.username || 'Creator'}</p>
                <Badge value={row.target} />
              </div>
              <p className="mt-1 text-gray-600">Views {row.eligibleViewsDelta} · {inr(row.amountDelta)}</p>
              <p className="mt-1 text-gray-500">{row.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const STAT_TONE = {
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
}

function Stat({ tone, icon: Icon, label, value, hint }) {
  return (
    <div className={`rounded-xl border border-white/60 p-4 ${STAT_TONE[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function Action({ children, onClick, tone }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  }
  return (
    <button type="button" className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold ${tones[tone] || 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`} onClick={onClick}>
      {children}
    </button>
  )
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input className={`${fieldClass} mt-1`} type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
