import { useState, useEffect, useMemo } from "react"
import { useListPlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer, getListPlayersQueryKey, useListTeams, useSendOnboardingInvites, useListFundraising, getListFundraisingQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MaskedInput } from "@/components/MaskedInput"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Trash2, Edit2, CheckCircle, XCircle, AlertTriangle, Shield, ShieldAlert, Link as LinkIcon, Lock, RefreshCw, Mail, Send, Clock, Upload } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Player, FundraisingEntry } from "@workspace/api-client-react"
import { useToast } from "@/hooks/use-toast"
import { getInitials, formatCurrency } from "@/lib/utils"
import { GRID_CRITERIA, computeReadiness, isFullyReady } from "@/lib/readiness"
import { passportStatus, PASSPORT_STATUS_LABEL } from "@/lib/reports"
import { format, parseISO } from "date-fns"

function cloudinaryViewUrl(url: string): string {
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
    if (url.toLowerCase().endsWith(".pdf")) return url.replace(/\.pdf$/i, ".jpg")
    if (/\.(heic|heif)$/i.test(url)) return url.replace(/\.(heic|heif)$/i, ".jpg")
  }
  return url
}

const CLOUDINARY_CLOUD_NAME = "djyvdrhal"
const CLOUDINARY_UPLOAD_PRESET = "hk_masters_unsigned"

declare global {
  interface Window {
    cloudinary?: {
      openUploadWidget: (
        options: Record<string, unknown>,
        callback: (error: unknown, result: { event: string; info?: { secure_url?: string } }) => void,
      ) => { close: () => void }
    }
  }
}

const SESSION_KEY = "hkm_admin_session"
function getStoredSession(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}
function storeSession(token: string) {
  try { localStorage.setItem(SESSION_KEY, token) } catch { /* noop */ }
}
function clearStoredSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
}

const PASSPORT_ACK_KEY = "hkm_passport_ack"
function getPassportAck(): Record<number, number> {
  try {
    const raw = localStorage.getItem(PASSPORT_ACK_KEY)
    return raw ? (JSON.parse(raw) as Record<number, number>) : {}
  } catch { return {} }
}
function setPassportAck(playerId: number) {
  try {
    const ack = getPassportAck()
    ack[playerId] = Date.now()
    localStorage.setItem(PASSPORT_ACK_KEY, JSON.stringify(ack))
  } catch { /* noop */ }
}
async function adminLogin(password: string): Promise<string> {
  const res = await fetch("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? "Login failed")
  }
  const data = await res.json() as { token: string }
  return data.token
}
async function fetchAccessToken(playerId: number, sessionToken: string): Promise<{ status: number; accessToken: string | null }> {
  const res = await fetch(`/api/players/${playerId}/access-token`, {
    headers: { "x-session-token": sessionToken },
  })
  if (res.status === 401) return { status: 401, accessToken: null }
  if (!res.ok) return { status: res.status, accessToken: null }
  const data = await res.json() as { accessToken: string | null }
  return { status: 200, accessToken: data.accessToken }
}
async function rotateAccessToken(playerId: number, sessionToken: string): Promise<{ status: number; accessToken: string | null }> {
  const res = await fetch(`/api/players/${playerId}/access-token/rotate`, {
    method: "POST",
    headers: { "x-session-token": sessionToken },
  })
  if (res.status === 401) return { status: 401, accessToken: null }
  if (!res.ok) return { status: res.status, accessToken: null }
  const data = await res.json() as { accessToken: string | null }
  return { status: 200, accessToken: data.accessToken }
}

const playerSchema = z.object({
  teamId: z.coerce.number().min(1, "Team selection is required"),
  name: z.string().min(1, "Name is required"),
  shirtNumber: z.union([z.coerce.number().int().min(1).max(99), z.literal("")]).optional(),
  email: z.union([z.string().email("Invalid email"), z.literal("")]).optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  flightArrivalDateTime: z.string().optional(),
  flightDepartureDateTime: z.string().optional(),
  arrivalCity: z.string().optional(),
  outboundFlightNumber: z.string().optional(),
  outboundDepartureDateTime: z.string().optional(),
  returnFlightNumber: z.string().optional(),
  returnArrivalDateTime: z.string().optional(),
  roomSharingPreference: z.string().optional(),
  roomSharingWith: z.string().optional(),
  accommodationName: z.string().optional(),
  accommodationAddress: z.string().optional(),
  accommodationPhone: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insuranceEmergencyPhone: z.string().optional(),
  insurancePolicyHolder: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  insuranceEmail: z.string().optional(),
  shirtSize: z.string().optional(),
  shortsSize: z.string().optional(),
  jacketSize: z.string().optional(),
  poloSize: z.string().optional(),
  trackTopSize: z.string().optional(),
  goalieSmockSize: z.string().optional(),
  travelDates: z.string().optional(),
  feePaid: z.boolean().default(false),
  passportCopyReviewed: z.boolean().default(false),
  paymentAmountDue: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentAmountPaid: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentDate: z.string().optional(),
  dietaryRequirements: z.string().optional(),
  medicalNotes: z.string().optional(),
  notes: z.string().optional(),
  instagramHandle: z.string().optional(),
  facebookHandle: z.string().optional(),
})

type PlayerFormValues = z.infer<typeof playerSchema>

function insuranceStatus(player: Player): "ok" | "missing" | "expired" {
  if (!player.insuranceProvider) return "missing"
  if (player.insuranceExpiry) {
    const d = new Date(player.insuranceExpiry)
    if (!isNaN(d.getTime()) && d < new Date()) return "expired"
  }
  return "ok"
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-border pb-2 mt-6 mb-3">
      {children}
    </h4>
  )
}

export default function Players() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [insuranceFilter, setInsuranceFilter] = useState<"all" | "missing" | "expired" | "issues">(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const v = params.get("insurance")
      if (v === "missing" || v === "expired" || v === "issues") return v
    } catch { /* noop */ }
    return "all"
  })
  const [passportAck, setPassportAckState] = useState<Record<number, number>>(() => getPassportAck())
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredSession())
  const [insuranceReminderModalOpen, setInsuranceReminderModalOpen] = useState(false)
  const [insuranceReminderSending, setInsuranceReminderSending] = useState(false)

  const acknowledgePassport = (playerId: number) => {
    setPassportAck(playerId)
    setPassportAckState(prev => ({ ...prev, [playerId]: Date.now() }))
  }

  const getPassportBadge = (player: { id: number; passportCopyUploadedAt?: string | null; passportCopyUploadedIsUpdate?: boolean | null }): "new" | "updated" | null => {
    if (!player.passportCopyUploadedAt) return null
    const uploadedMs = new Date(player.passportCopyUploadedAt).getTime()
    const ackedMs = passportAck[player.id] ?? 0
    if (uploadedMs <= ackedMs) return null
    return player.passportCopyUploadedIsUpdate ? "updated" : "new"
  }

  useEffect(() => {
    setPassportAckState(getPassportAck())
  }, [])

  const { data: teams = [] } = useListTeams()
  const { data: fundraisingEntries = [] } = useListFundraising({
    query: { queryKey: getListFundraisingQueryKey(), enabled: !!sessionToken, retry: false }
  })
  const { data: players = [], isLoading, isFetching, refetch } = useListPlayers(
    selectedTeamFilter !== "all" ? { teamId: parseInt(selectedTeamFilter) } : undefined,
    { query: { queryKey: getListPlayersQueryKey(selectedTeamFilter !== "all" ? { teamId: parseInt(selectedTeamFilter) } : undefined), refetchInterval: 30_000 } }
  )

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [deepLinkHandled, setDeepLinkHandled] = useState(false)

  const createMutation = useCreatePlayer()
  const updateMutation = useUpdatePlayer()
  const deleteMutation = useDeletePlayer()
  const sendInvitesMutation = useSendOnboardingInvites()

  const handleSendInvite = async (player: Player) => {
    if (!player.email) {
      toast({ title: "Player has no email on file", variant: "destructive" })
      return
    }
    if (player.onboardingInviteSentAt && !confirm(`Onboarding invite was already sent to ${player.name} on ${new Date(player.onboardingInviteSentAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}. Re-send?`)) return
    try {
      const result = await sendInvitesMutation.mutateAsync({ data: { playerIds: [player.id] } })
      if (result.sent > 0) {
        toast({ title: `Invite sent to ${player.name}` })
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      } else if (result.skippedNoEmail && result.skippedNoEmail > 0) {
        toast({ title: "Skipped — no email on file", description: `Add an email address to ${player.name}'s record first.`, variant: "destructive" })
      } else {
        toast({ title: "Failed to send invite", description: "Email service rejected the message — check server logs.", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to send invite", variant: "destructive" })
    }
  }

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerSchema)
  })

  const filteredPlayers = players
    .filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.nationality || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(p => {
      if (insuranceFilter === "all") return true
      const status = insuranceStatus(p)
      if (insuranceFilter === "missing") return status === "missing"
      if (insuranceFilter === "expired") return status === "expired"
      if (insuranceFilter === "issues") return status === "missing" || status === "expired"
      return true
    })
    .sort((a, b) => sortOrder === "asc"
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name)
    )

  const playersWithoutInsurance = players.filter(p => !p.insuranceProvider)

  const handleSendInsuranceReminders = async () => {
    if (playersWithoutInsurance.length === 0) return
    setInsuranceReminderSending(true)
    try {
      const token = sessionToken
      const res = await fetch("/api/players/send-insurance-reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-session-token": token } : {}),
        },
        body: JSON.stringify({ playerIds: playersWithoutInsurance.map(p => p.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to send reminders")
      const { sent, failed } = data as { sent: number; failed: number }
      if (failed > 0) {
        toast({ title: `Sent to ${sent} player${sent !== 1 ? "s" : ""} — ${failed} failed`, variant: "destructive" })
      } else {
        toast({ title: `Insurance reminder sent to ${sent} player${sent !== 1 ? "s" : ""}` })
      }
      setInsuranceReminderModalOpen(false)
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to send reminders", variant: "destructive" })
    } finally {
      setInsuranceReminderSending(false)
    }
  }

  const blankForm = (): Partial<PlayerFormValues> => ({
    teamId: teams.length > 0 ? teams[0].id : 0,
    name: "", shirtNumber: "", email: "", phone: "", position: "",
    dateOfBirth: "", nationality: "", passportNumber: "", passportExpiry: "",
    emergencyContactName: "", emergencyContactPhone: "",
    flightArrivalDateTime: "", flightDepartureDateTime: "", arrivalCity: "",
    outboundFlightNumber: "", outboundDepartureDateTime: "",
    returnFlightNumber: "", returnArrivalDateTime: "",
    roomSharingPreference: "shared", roomSharingWith: "",
    accommodationName: "", accommodationAddress: "", accommodationPhone: "",
    insuranceProvider: "", insurancePolicyNumber: "", insuranceEmergencyPhone: "",
    insurancePolicyHolder: "", insuranceExpiry: "", insuranceEmail: "",
    shirtSize: "", shortsSize: "", jacketSize: "", poloSize: "", trackTopSize: "", goalieSmockSize: "", travelDates: "",
    feePaid: false, passportCopyReviewed: false,
    paymentAmountDue: "", paymentAmountPaid: "", paymentDate: "",
    dietaryRequirements: "", medicalNotes: "", notes: "",
    instagramHandle: "", facebookHandle: "",
  })

  const openAddModal = () => {
    setEditingPlayer(null)
    reset(blankForm())
    setIsModalOpen(true)
  }

  const openEditModal = (player: Player) => {
    setEditingPlayer(player)
    if (player.passportCopyUploadedAt) acknowledgePassport(player.id)
    reset({
      teamId: player.teamId,
      name: player.name,
      shirtNumber: player.shirtNumber ?? "",
      email: player.email,
      phone: player.phone || "",
      position: player.position || "",
      dateOfBirth: player.dateOfBirth || "",
      nationality: player.nationality || "",
      passportNumber: player.passportNumber || "",
      passportExpiry: player.passportExpiry || "",
      emergencyContactName: player.emergencyContactName || "",
      emergencyContactPhone: player.emergencyContactPhone || "",
      flightArrivalDateTime: player.flightArrivalDateTime || "",
      flightDepartureDateTime: player.flightDepartureDateTime || "",
      arrivalCity: player.arrivalCity || "",
      outboundFlightNumber: player.outboundFlightNumber || "",
      outboundDepartureDateTime: player.outboundDepartureDateTime || "",
      returnFlightNumber: player.returnFlightNumber || "",
      returnArrivalDateTime: player.returnArrivalDateTime || "",
      roomSharingPreference: player.roomSharingPreference || "shared",
      roomSharingWith: player.roomSharingWith || "",
      accommodationName: player.accommodationName || "",
      accommodationAddress: player.accommodationAddress || "",
      accommodationPhone: player.accommodationPhone || "",
      insuranceProvider: player.insuranceProvider || "",
      insurancePolicyNumber: player.insurancePolicyNumber || "",
      insuranceEmergencyPhone: player.insuranceEmergencyPhone || "",
      insurancePolicyHolder: player.insurancePolicyHolder || "",
      insuranceExpiry: player.insuranceExpiry || "",
      insuranceEmail: player.insuranceEmail || "",
      shirtSize: player.shirtSize || "",
      shortsSize: player.shortsSize || "",
      jacketSize: player.jacketSize || "",
      poloSize: player.poloSize || "",
      trackTopSize: player.trackTopSize || "",
      goalieSmockSize: player.goalieSmockSize || "",
      travelDates: player.travelDates || "",
      feePaid: player.feePaid,
      passportCopyReviewed: player.passportCopyReviewed ?? false,
      paymentAmountDue: player.paymentAmountDue ?? "",
      paymentAmountPaid: player.paymentAmountPaid ?? "",
      paymentDate: player.paymentDate || "",
      dietaryRequirements: player.dietaryRequirements || "",
      medicalNotes: player.medicalNotes || "",
      notes: player.notes || "",
      instagramHandle: player.instagramHandle || "",
      facebookHandle: player.facebookHandle || "",
    })
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (deepLinkHandled || isLoading || players.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const playerIdParam = params.get("playerId")
    if (!playerIdParam) return
    const targetId = parseInt(playerIdParam, 10)
    const target = players.find((p) => p.id === targetId)
    if (target) {
      openEditModal(target)
    }
    setDeepLinkHandled(true)
  }, [players, isLoading, deepLinkHandled])

  const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) || "https://hkmastershockey.com"

  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null)

  const completeCopy = async (player: Player, accessToken: string) => {
    const url = `${PUBLIC_SITE_URL.replace(/\/$/, "")}/my-details/${accessToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "Self-service link copied", description: `Share with ${player.name}` })
    } catch {
      window.prompt("Copy this link to share with the player:", url)
    }
  }

  const handleCopyLink = async (player: Player) => {
    const session = getStoredSession()
    if (!session) {
      setPendingPlayer(player)
      setLoginPassword("")
      setLoginError(null)
      setLoginModalOpen(true)
      return
    }
    const result = await fetchAccessToken(player.id, session)
    if (result.status === 401) {
      clearStoredSession()
      setPendingPlayer(player)
      setLoginPassword("")
      setLoginError(null)
      setLoginModalOpen(true)
      return
    }
    if (result.status !== 200 || !result.accessToken) {
      toast({ title: "No link available for this player yet", variant: "destructive" })
      return
    }
    await completeCopy(player, result.accessToken)
  }

  const handleRotateLink = async (player: Player) => {
    if (!confirm(`Rotate self-service link for ${player.name}? The current link will stop working immediately.`)) return
    const session = getStoredSession()
    if (!session) {
      toast({ title: "Sign in to rotate the link", variant: "destructive" })
      return
    }
    const result = await rotateAccessToken(player.id, session)
    if (result.status === 401) {
      clearStoredSession()
      toast({ title: "Session expired — copy the link again to sign in", variant: "destructive" })
      return
    }
    if (result.status !== 200 || !result.accessToken) {
      toast({ title: "Failed to rotate link", variant: "destructive" })
      return
    }
    await completeCopy(player, result.accessToken)
    toast({ title: "Link rotated and copied to clipboard" })
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      const token = await adminLogin(loginPassword)
      storeSession(token)
      setSessionToken(token)
      setLoginModalOpen(false)
      setLoginPassword("")
      if (pendingPlayer) {
        const result = await fetchAccessToken(pendingPlayer.id, token)
        if (result.status === 200 && result.accessToken) {
          await completeCopy(pendingPlayer, result.accessToken)
        } else {
          toast({ title: "No link available for this player yet", variant: "destructive" })
        }
        setPendingPlayer(null)
      }
    } catch (err) {
      setLoginError((err as Error).message || "Login failed")
    } finally {
      setLoginLoading(false)
    }
  }

  const [uploadingPassportFor, setUploadingPassportFor] = useState<number | null>(null)

  const handleAdminUploadPassport = (player: Player) => {
    if (!window.cloudinary || typeof window.cloudinary.openUploadWidget !== "function") {
      toast({ title: "Upload service not ready yet — try again in a moment", variant: "destructive" })
      return
    }
    if (uploadingPassportFor !== null) return
    setUploadingPassportFor(player.id)
    window.cloudinary.openUploadWidget(
      {
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        sources: ["local", "camera"],
        multiple: false,
        resourceType: "auto",
        accessMode: "public",
        clientAllowedFormats: ["jpg", "jpeg", "png", "pdf", "heic", "webp"],
        maxFileSize: 10000000,
        folder: "passport-copies",
        cropping: false,
        showAdvancedOptions: false,
        showPoweredBy: false,
      },
      async (error, result) => {
        if (error) {
          setUploadingPassportFor(null)
          toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" })
          return
        }
        if (result.event === "close") {
          setUploadingPassportFor(null)
          return
        }
        if (result.event !== "success") return
        const url = result.info?.secure_url
        if (!url) {
          setUploadingPassportFor(null)
          toast({ title: "Upload failed", description: "No file URL returned.", variant: "destructive" })
          return
        }
        try {
          await updateMutation.mutateAsync({
            id: player.id,
            data: {
              name: player.name,
              teamId: player.teamId,
              email: player.email,
              feePaid: player.feePaid,
              passportCopyUrl: url,
              passportCopyReviewed: true,
            },
          })
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
          acknowledgePassport(player.id)
          if (editingPlayer && editingPlayer.id === player.id) {
            setEditingPlayer({ ...editingPlayer, passportCopyUrl: url, passportCopyReviewed: true })
            setValue("passportCopyReviewed", true, { shouldDirty: false })
          }
          toast({ title: `Passport uploaded for ${player.name}` })
        } catch {
          toast({ title: "File uploaded but could not be saved", variant: "destructive" })
        } finally {
          setUploadingPassportFor(null)
        }
      },
    )
  }

  const handleToggleReviewed = async (player: Player) => {
    try {
      await updateMutation.mutateAsync({
        id: player.id,
        data: {
          name: player.name,
          teamId: player.teamId,
          email: player.email,
          feePaid: player.feePaid,
          passportCopyReviewed: !player.passportCopyReviewed,
        },
      })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      toast({ title: player.passportCopyReviewed ? "Marked as not reviewed" : "Marked as reviewed" })
    } catch {
      toast({ title: "Failed to update review status", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this player?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      toast({ title: "Player deleted" })
    } catch {
      toast({ title: "Failed to delete player", variant: "destructive" })
    }
  }

  const onSubmit = async (data: PlayerFormValues) => {
    try {
      const clean = (v: any) => v === "" ? undefined : v
      const payload = {
        ...data,
        shirtNumber: clean(data.shirtNumber) as number | undefined,
        paymentAmountDue: clean(data.paymentAmountDue) as number | undefined,
        paymentAmountPaid: clean(data.paymentAmountPaid) as number | undefined,
      }
      if (editingPlayer) {
        await updateMutation.mutateAsync({ id: editingPlayer.id, data: payload as any })
        toast({ title: "Player updated" })
      } else {
        await createMutation.mutateAsync({ data: payload as any })
        toast({ title: "Player added" })
      }
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  const playerDonors = useMemo<FundraisingEntry[]>(() => {
    if (!editingPlayer || fundraisingEntries.length === 0) return []
    const name = editingPlayer.name.trim()
    return fundraisingEntries
      .filter((e) => e.beneficiary?.trim() === name)
      .slice()
      .sort((a, b) => b.amountPledged - a.amountPledged)
  }, [editingPlayer, fundraisingEntries])

  const exportPlayerDonorsCSV = (playerLabel: string, donors: FundraisingEntry[]) => {
    const slug = playerLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = [
      ["Donor", "Email", "Pledged (HKD)", "Received (HKD)", "Status", "Date"].map(escape).join(","),
      ...donors.map((d) => {
        const dateStr = d.paidAt ?? d.date
        const dateLabel = dateStr ? format(parseISO(dateStr), "d MMM yyyy") : ""
        return [
          escape(d.donorName ?? ""),
          escape(d.donorEmail ?? ""),
          escape(String(d.amountPledged ?? 0)),
          escape(String(d.amountReceived ?? 0)),
          escape(d.status ?? ""),
          escape(dateLabel),
        ].join(",")
      }),
    ]
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `donors-${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageLayout
      title="Roster"
      description="Manage player profiles, travel details, sizes, and payments."
      action={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh player list (also auto-refreshes every 30 seconds)"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          <Button onClick={openAddModal} disabled={teams.length === 0}>
            <Plus className="w-5 h-5 mr-2" /> Add Player
          </Button>
        </div>
      }
    >
      <div className="bg-white rounded-2xl shadow-sm border border-border flex flex-col min-h-[500px] overflow-hidden">

        {/* Filters */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 bg-muted/20 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or nationality..."
              className="pl-10 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            className="sm:w-52 bg-white"
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
          >
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id.toString()}>{t.name}</option>)}
          </Select>
          <Select
            className="sm:w-52 bg-white"
            value={insuranceFilter}
            onChange={(e) => setInsuranceFilter(e.target.value as typeof insuranceFilter)}
          >
            <option value="all">All Insurance</option>
            <option value="issues">⚠ Missing or Expired</option>
            <option value="missing">Missing Insurance</option>
            <option value="expired">Expired Insurance</option>
          </Select>
          {playersWithoutInsurance.length > 0 && (
            <button
              onClick={() => setInsuranceReminderModalOpen(true)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium border bg-amber-600 text-white border-amber-700 hover:bg-amber-700 transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Remind {playersWithoutInsurance.length} player{playersWithoutInsurance.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-4 font-semibold">#</th>
                <th className="px-4 py-4 font-semibold">
                  <button
                    onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Player
                    <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  </button>
                </th>
                <th className="px-4 py-4 font-semibold hidden sm:table-cell">Team</th>
                <th className="px-4 py-4 font-semibold hidden md:table-cell">Position</th>
                <th className="px-4 py-4 font-semibold hidden lg:table-cell">Nationality</th>
                <th className="px-4 py-4 font-semibold hidden xl:table-cell">Portal</th>
                <th className="px-4 py-4 font-semibold">Fee</th>
                <th className="px-4 py-4 font-semibold hidden xl:table-cell">Insurance</th>
                <th className="px-4 py-4 font-semibold hidden xl:table-cell">Passport Expiry</th>
                <th className="px-4 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">Loading players...</td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    {players.length === 0 ? "No players yet. Add your first player to get started." : "No players match your search."}
                  </td>
                </tr>
              ) : (
                filteredPlayers.map(player => {
                  const pStatus = passportStatus(player.passportExpiry)
                  return (
                    <tr key={player.id} className="hover:bg-muted/10 transition-colors group cursor-pointer" onClick={() => openEditModal(player)}>
                      {/* Shirt Number */}
                      <td className="px-4 py-4">
                        {player.shirtNumber != null ? (
                          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {player.shirtNumber}
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center text-xs">—</div>
                        )}
                      </td>
                      {/* Name */}
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {getInitials(player.name)}
                          </div>
                          <div>
                            <div className="font-bold text-foreground flex items-center gap-2">
                              {player.name}
                              {(() => {
                                const badge = getPassportBadge(player)
                                if (!badge) return null
                                return badge === "updated"
                                  ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 leading-none">Updated</span>
                                  : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 leading-none">New</span>
                              })()}
                            </div>
                            <div className="text-muted-foreground text-xs sm:hidden">{player.teamName}</div>
                          </div>
                        </div>
                      </td>
                      {/* Team */}
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <Badge variant="outline">{player.teamName ?? '—'}</Badge>
                      </td>
                      {/* Position */}
                      <td className="px-4 py-4 hidden md:table-cell text-foreground">
                        {player.position || <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      {/* Nationality */}
                      <td className="px-4 py-4 hidden lg:table-cell text-foreground">
                        {player.nationality || <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      {/* Portal login status */}
                      <td className="px-4 py-4 hidden xl:table-cell">
                        {player.lastLoginAt ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(player.lastLoginAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </span>
                          </div>
                        ) : player.onboardingInviteSentAt ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                            <Clock className="w-3 h-3" /> Invited
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      {/* Fee */}
                      <td className="px-4 py-4">
                        {player.feePaid ? (
                          <Badge variant="success" className="gap-1 whitespace-nowrap"><CheckCircle className="w-3 h-3" /> Paid</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 whitespace-nowrap bg-rose-100 text-rose-800"><XCircle className="w-3 h-3" /> Unpaid</Badge>
                        )}
                      </td>
                      {/* Insurance */}
                      <td className="px-4 py-4 hidden xl:table-cell">
                        {(() => {
                          const status = insuranceStatus(player)
                          if (status === "ok") return (
                            <div className="flex items-center gap-1.5 text-emerald-700">
                              <Shield className="w-4 h-4" />
                              <span className="text-sm font-medium">{player.insuranceProvider}</span>
                            </div>
                          )
                          if (status === "expired") return (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-rose-600">
                                <ShieldAlert className="w-4 h-4" />
                                <span className="text-sm font-medium">Expired</span>
                              </div>
                              <span className="text-[10px] text-rose-500">{player.insuranceExpiry}</span>
                            </div>
                          )
                          return (
                            <div className="flex items-center gap-1.5 text-amber-600">
                              <ShieldAlert className="w-4 h-4" />
                              <span className="text-sm font-medium">Missing</span>
                            </div>
                          )
                        })()}
                      </td>
                      {/* Passport Expiry */}
                      <td className="px-4 py-4 hidden xl:table-cell">
                        {pStatus === "ok" && (
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <Shield className="w-4 h-4" />
                            <span className="text-sm font-medium">{player.passportExpiry}</span>
                          </div>
                        )}
                        {pStatus === "expiring" && (
                          <div className="flex items-center gap-1.5 text-rose-600">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium">{player.passportExpiry}</span>
                          </div>
                        )}
                        {pStatus === "missing" && (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                        {player.passportCopyUrl && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <a
                              href={cloudinaryViewUrl(player.passportCopyUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              onClick={(e) => { e.stopPropagation(); acknowledgePassport(player.id) }}
                            >
                              <LinkIcon className="w-3 h-3" />
                              View copy
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleReviewed(player) }}
                              title={player.passportCopyReviewed ? "Reviewed — click to unmark" : "Not yet reviewed — click to mark as reviewed"}
                              className={`inline-flex items-center gap-1 text-xs font-medium rounded px-1.5 py-0.5 border transition-colors ${
                                player.passportCopyReviewed
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              }`}
                            >
                              {player.passportCopyReviewed
                                ? <><CheckCircle className="w-3 h-3" /> Reviewed</>
                                : <><Clock className="w-3 h-3" /> Unreviewed</>
                              }
                            </button>
                          </div>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSendInvite(player) }}
                            disabled={sendInvitesMutation.isPending}
                            title={player.onboardingInviteSentAt
                              ? `Onboarding invite sent ${new Date(player.onboardingInviteSentAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — click to re-send`
                              : "Email onboarding link to this player"}
                            className={`p-2 rounded bg-background border shadow-sm transition-all disabled:opacity-50 ${
                              player.onboardingInviteSentAt
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                            }`}
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyLink(player) }}
                            title="Copy self-service link (admin)"
                            className="p-2 text-muted-foreground hover:text-emerald-600 rounded bg-background hover:bg-emerald-50 border shadow-sm transition-all"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRotateLink(player) }}
                            title="Rotate self-service link (revokes old one)"
                            className="p-2 text-muted-foreground hover:text-amber-600 rounded bg-background hover:bg-amber-50 border shadow-sm transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(player) }} className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background hover:bg-blue-50 border shadow-sm transition-all">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(player.id) }} className="p-2 text-muted-foreground hover:text-rose-600 rounded bg-background hover:bg-rose-50 border shadow-sm transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlayer ? "Edit Player" : "Add Player"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-1">

          {/* ── Readiness summary strip (edit mode only) ── */}
          {editingPlayer && (() => {
            const ready = computeReadiness(editingPlayer)
            const passCount = Object.values(ready).filter(Boolean).length
            const total = GRID_CRITERIA.length
            const allReady = isFullyReady(editingPlayer)
            return (
              <div className={`rounded-xl border px-4 py-3 mb-2 ${allReady ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${allReady ? "text-green-700" : "text-amber-700"}`}>
                    Tournament readiness
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${allReady ? "text-green-700" : "text-amber-700"}`}>
                    {passCount}/{total}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GRID_CRITERIA.map((c) => {
                    const pass = ready[c.key]
                    return (
                      <span
                        key={c.key}
                        title={c.label}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                          pass
                            ? "bg-green-100 text-green-800 border-green-200"
                            : c.severity === "red"
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-amber-100 text-amber-800 border-amber-200"
                        }`}
                      >
                        {pass ? "✓" : "✗"} {c.short}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <SectionHeading>Basic Info</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">Team *</label>
              <Select {...register("teamId")}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              {errors.teamId && <p className="text-xs text-destructive">{errors.teamId.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Full Name *</label>
              <Input {...register("name")} placeholder="Jane Doe" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Shirt Number</label>
              <Input type="number" min="1" max="99" {...register("shirtNumber")} placeholder="1-99" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Email <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input type="email" {...register("email")} placeholder="jane@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Phone</label>
              <Input {...register("phone")} placeholder="+852 XXXX XXXX" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Position</label>
              <Input {...register("position")} placeholder="Forward, Midfield, Defender, GK..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Date of Birth</label>
              <Input type="date" {...register("dateOfBirth")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nationality</label>
              <Input {...register("nationality")} placeholder="e.g. Hong Kong" />
            </div>
          </div>

          <SectionHeading>Passport</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Passport Number</label>
              <MaskedInput {...register("passportNumber")} placeholder="A1234567" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Passport Expiry</label>
              <Input type="date" {...register("passportExpiry")} />
            </div>
            {editingPlayer && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold">Passport Copy</label>
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5 border flex-wrap">
                  <Shield className={`w-4 h-4 shrink-0 ${editingPlayer.passportCopyUrl ? "text-emerald-600" : "text-muted-foreground"}`} />
                  <span className="text-sm text-muted-foreground flex-1 min-w-[8rem]">
                    {editingPlayer.passportCopyUrl ? "Passport copy on file" : "No passport copy uploaded yet"}
                  </span>
                  {editingPlayer.passportCopyUrl && (
                    <a
                      href={cloudinaryViewUrl(editingPlayer.passportCopyUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      View
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editingPlayer && handleAdminUploadPassport(editingPlayer)}
                    disabled={uploadingPassportFor === editingPlayer.id}
                    className="shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {uploadingPassportFor === editingPlayer.id
                      ? "Uploading…"
                      : editingPlayer.passportCopyUrl
                        ? "Replace on behalf of player"
                        : "Upload on behalf of player"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this if a player emailed you their passport because the in-app upload didn't work for them. The file will be marked as reviewed automatically.
                </p>
                {editingPlayer.passportCopyUrl && (
                  <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-xl border">
                    <input
                      type="checkbox"
                      id="passportCopyReviewed"
                      className="w-5 h-5 rounded border-2 text-primary focus:ring-primary accent-primary"
                      {...register("passportCopyReviewed")}
                    />
                    <label htmlFor="passportCopyReviewed" className="font-semibold cursor-pointer text-sm">
                      Passport copy reviewed and valid
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <SectionHeading>Emergency Contact</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Emergency Contact Name</label>
              <Input {...register("emergencyContactName")} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Emergency Contact Phone</label>
              <Input {...register("emergencyContactPhone")} placeholder="+852 XXXX XXXX" />
            </div>
          </div>

          <SectionHeading>Travel</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">Travel Dates (Summary)</label>
              <Input {...register("travelDates")} placeholder="e.g. 10 Jul – 25 Jul" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide md:col-span-2 mt-2 mb-0">Outbound (Hong Kong → Europe)</p>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Flight Number</label>
              <Input {...register("outboundFlightNumber")} placeholder="e.g. KL888" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Departs Hong Kong (HKT)</label>
              <Input type="datetime-local" {...register("outboundDepartureDateTime")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Arrives in Europe (local time)</label>
              <Input type="datetime-local" {...register("flightArrivalDateTime")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Arrival City/Airport</label>
              <Input {...register("arrivalCity")} placeholder="e.g. Amsterdam Schiphol (AMS)" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide md:col-span-2 mt-2 mb-0">Return (Europe → Hong Kong)</p>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Flight Number</label>
              <Input {...register("returnFlightNumber")} placeholder="e.g. KL887" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Departs Europe (local time)</label>
              <Input type="datetime-local" {...register("flightDepartureDateTime")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Arrives Hong Kong (HKT)</label>
              <Input type="datetime-local" {...register("returnArrivalDateTime")} />
            </div>
          </div>

          <SectionHeading>Accommodation</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Room Sharing Preference</label>
              <Select {...register("roomSharingPreference")}>
                <option value="shared">Shared</option>
                <option value="single">Single</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Room Sharing With (Player Name)</label>
              <Input {...register("roomSharingWith")} placeholder="Preferred roommate" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">Accommodation Name</label>
              <Input {...register("accommodationName")} placeholder="e.g. Hotel Atlanta Rotterdam" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">Accommodation Address</label>
              <Input {...register("accommodationAddress")} placeholder="Street, city, postcode" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Accommodation Phone</label>
              <Input {...register("accommodationPhone")} placeholder="+31 10 000 0000" />
            </div>
          </div>

          <SectionHeading>Insurance</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">Insurance Provider</label>
              <Input {...register("insuranceProvider")} placeholder="e.g. AXA, Zurich, HSBC Insurance" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Policy Number</label>
              <Input {...register("insurancePolicyNumber")} placeholder="e.g. POL-12345678" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">24/7 Emergency Assistance Phone</label>
              <Input {...register("insuranceEmergencyPhone")} placeholder="+852 XXXX XXXX" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Policy Holder Name <span className="text-muted-foreground font-normal">(if different from player)</span></label>
              <Input {...register("insurancePolicyHolder")} placeholder="Full name on policy" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Policy Expiry Date</label>
              <Input type="date" {...register("insuranceExpiry")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">General Contact Email</label>
              <Input type="email" {...register("insuranceEmail")} placeholder="claims@insurer.com" />
            </div>
          </div>

          <SectionHeading>Kit Sizes</SectionHeading>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Shirt</label>
              <Input {...register("shirtSize")} placeholder="S/M/L/XL" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Shorts</label>
              <Input {...register("shortsSize")} placeholder="S/M/L/XL" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Jacket</label>
              <Input {...register("jacketSize")} placeholder="S/M/L/XL" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Polo</label>
              <Input {...register("poloSize")} placeholder="S/M/L/XL" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Track Top</label>
              <Input {...register("trackTopSize")} placeholder="S/M/L/XL" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Goalie Smock (GK only)</label>
              <Input {...register("goalieSmockSize")} placeholder="S/M/L/XL" />
            </div>
          </div>

          <SectionHeading>Payment</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Amount Due (HKD)</label>
              <Input type="number" step="0.01" min="0" {...register("paymentAmountDue")} placeholder="0" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Amount Paid (HKD)</label>
              <Input type="number" step="0.01" min="0" {...register("paymentAmountPaid")} placeholder="0" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Payment Date</label>
              <Input type="date" {...register("paymentDate")} />
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-xl border mt-3">
            <input
              type="checkbox"
              id="feePaid"
              className="w-5 h-5 rounded border-2 text-primary focus:ring-primary accent-primary"
              {...register("feePaid")}
            />
            <label htmlFor="feePaid" className="font-semibold cursor-pointer">Tournament Fee Fully Paid</label>
          </div>

          <SectionHeading>Health & Notes</SectionHeading>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Dietary Requirements</label>
              <Input {...register("dietaryRequirements")} placeholder="None, Vegetarian, Halal, etc." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Medical Notes</label>
              <Input {...register("medicalNotes")} placeholder="Allergies, conditions, medication..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">General Notes</label>
              <Input {...register("notes")} placeholder="Any other information..." />
            </div>
          </div>

          <SectionHeading>Social Media</SectionHeading>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Instagram Handle</label>
              <Input {...register("instagramHandle")} placeholder="@username" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Facebook Handle</label>
              <Input {...register("facebookHandle")} placeholder="username or profile URL" />
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t mt-6">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingPlayer ? "Update Player" : "Add Player"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={loginModalOpen}
        onClose={() => { setLoginModalOpen(false); setPendingPlayer(null) }}
        title="Admin login required"
      >
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mx-auto">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Self-service links are admin-only. Enter the admin password to copy this link.
          </p>
          <Input
            type="password"
            placeholder="Admin password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            autoFocus
          />
          {loginError && <p className="text-xs text-destructive">{loginError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setLoginModalOpen(false); setPendingPlayer(null) }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loginLoading || !loginPassword}>
              {loginLoading ? "Signing in…" : "Sign in & copy"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Insurance reminder modal */}
      <Modal
        isOpen={insuranceReminderModalOpen}
        onClose={() => setInsuranceReminderModalOpen(false)}
        title="Send insurance reminder"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will send a reminder email to{" "}
            <strong className="text-foreground">{playersWithoutInsurance.length} player{playersWithoutInsurance.length !== 1 ? "s" : ""}</strong>{" "}
            who have no insurance provider on file.
          </p>
          <p className="text-sm text-muted-foreground">
            Each email will include a personal link directly to the player's My Details page so they can fill in their insurance information immediately.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">Players who will be emailed:</p>
            <ul className="text-xs text-amber-700 space-y-0.5 max-h-32 overflow-y-auto">
              {playersWithoutInsurance.map(p => (
                <li key={p.id}>{p.name}{p.teamName ? ` — ${p.teamName}` : ""}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInsuranceReminderModalOpen(false)}
              disabled={insuranceReminderSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInsuranceReminders}
              disabled={insuranceReminderSending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {insuranceReminderSending ? "Sending…" : `Send to ${playersWithoutInsurance.length} player${playersWithoutInsurance.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
