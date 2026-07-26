import { useState, useEffect, useRef } from "react"
import { useListSponsors, useCreateSponsor, useUpdateSponsor, useDeleteSponsor, getListSponsorsQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Star, Lock, ExternalLink, ImageOff, Upload } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Sponsor } from "@workspace/api-client-react"
import { useToast } from "@/hooks/use-toast"

const SESSION_KEY = "hkm_admin_session"
function getStoredToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}
function storeToken(token: string) {
  try { localStorage.setItem(SESSION_KEY, token) } catch { /* noop */ }
}
async function apiLogin(password: string): Promise<string> {
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
async function apiCheckSession(token: string): Promise<boolean> {
  const res = await fetch("/api/admin/auth", { headers: { "x-session-token": token } })
  const data = await res.json() as { authenticated: boolean }
  return data.authenticated
}

const sponsorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  logoUrl: z.union([z.string().url(), z.string().startsWith("/"), z.literal("")]).optional(),
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tier: z.enum(["Gold", "Silver", "Bronze"]),
  active: z.boolean(),
  contributionAmount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().positive("Must be a positive number").nullable().optional()
  ),
})

type SponsorFormValues = z.infer<typeof sponsorSchema>

const TIER_COLORS: Record<string, string> = {
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-100 text-gray-700",
  Bronze: "bg-orange-100 text-orange-800",
}

const TIER_ORDER: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 }

export default function Sponsors() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowed.includes(file.type)) {
      toast({ title: "Only image files are allowed (JPEG, PNG, GIF, WebP)", variant: "destructive" })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image too large — max 10 MB", variant: "destructive" })
      return
    }
    setUploading(true)
    try {
      const token = getStoredToken()
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/sponsors/image-upload", {
        method: "POST",
        headers: token ? { "x-session-token": token } : {},
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Upload failed: ${res.status}`)
      }
      const { imageUrl } = await res.json() as { imageUrl: string }
      setValue("logoUrl", imageUrl, { shouldValidate: true })
      toast({ title: "Logo uploaded" })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    const stored = getStoredToken()
    if (stored) {
      apiCheckSession(stored).then((valid) => {
        if (valid) setSessionToken(stored)
        setSessionChecked(true)
      }).catch(() => setSessionChecked(true))
    } else {
      setSessionChecked(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      const token = await apiLogin(loginPassword)
      storeToken(token)
      setSessionToken(token)
      setLoginPassword("")
      queryClient.invalidateQueries()
    } catch (err) {
      setLoginError((err as Error).message || "Login failed")
    } finally {
      setLoginLoading(false)
    }
  }

  const { data: sponsors = [], isLoading } = useListSponsors({ query: { queryKey: getListSponsorsQueryKey(), enabled: !!sessionToken } })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)

  const createMutation = useCreateSponsor()
  const updateMutation = useUpdateSponsor()
  const deleteMutation = useDeleteSponsor()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<SponsorFormValues>({
    resolver: zodResolver(sponsorSchema),
    defaultValues: { active: true, tier: "Bronze" },
  })

  const watchLogoUrl = watch("logoUrl")

  const openAddModal = () => {
    setEditingSponsor(null)
    reset({ name: "", logoUrl: "", websiteUrl: "", tier: "Bronze", active: true, contributionAmount: null })
    setIsModalOpen(true)
  }

  const openEditModal = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor)
    reset({
      name: sponsor.name,
      logoUrl: sponsor.logoUrl || "",
      websiteUrl: sponsor.websiteUrl || "",
      tier: sponsor.tier as "Gold" | "Silver" | "Bronze",
      active: sponsor.active,
      contributionAmount: sponsor.contributionAmount ?? null,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this sponsor? This cannot be undone.")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListSponsorsQueryKey() })
      toast({ title: "Sponsor deleted" })
    } catch {
      toast({ title: "Failed to delete sponsor", variant: "destructive" })
    }
  }

  const onSubmit = async (data: SponsorFormValues) => {
    try {
      const payload = {
        name: data.name,
        logoUrl: data.logoUrl || undefined,
        websiteUrl: data.websiteUrl || undefined,
        tier: data.tier,
        active: data.active,
        contributionAmount: data.contributionAmount ?? null,
      }
      if (editingSponsor) {
        await updateMutation.mutateAsync({ id: editingSponsor.id, data: payload })
        toast({ title: "Sponsor updated" })
      } else {
        await createMutation.mutateAsync({ data: payload })
        toast({ title: "Sponsor added" })
      }
      queryClient.invalidateQueries({ queryKey: getListSponsorsQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  const sortedSponsors = [...sponsors].sort((a, b) => {
    const tierDiff = (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3)
    if (tierDiff !== 0) return tierDiff
    return a.name.localeCompare(b.name)
  })

  const activeSponsorCount = sponsors.filter((s) => s.active).length
  const missingLogoCount = sponsors.filter((s) => !s.logoUrl).length
  const hasContributions = sponsors.some((s) => s.contributionAmount != null)
  const totalContributions = sponsors.reduce((sum, s) => sum + (s.contributionAmount ?? 0), 0)

  if (!sessionChecked) {
    return (
      <PageLayout title="Sponsors" description="Checking access...">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </PageLayout>
    )
  }

  if (!sessionToken) {
    return (
      <PageLayout title="Sponsors" description="Admin access required to manage sponsors.">
        <div className="max-w-sm mx-auto mt-12">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mx-auto mb-5">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-center mb-1">Admin Login</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Enter your admin password to manage sponsors.</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Admin password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoFocus
              />
              {loginError && <p className="text-xs text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full" disabled={loginLoading || !loginPassword}>
                {loginLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Sponsors"
      description="Manage sponsors displayed on the public website."
      action={
        <Button onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" /> Add Sponsor
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {(["Gold", "Silver", "Bronze"] as const).map((tier) => {
          const count = sponsors.filter((s) => s.tier === tier && s.active).length
          return (
            <div key={tier} className="bg-white rounded-2xl border border-border shadow-sm p-6 flex items-center gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${TIER_COLORS[tier]}`}>
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tier} Sponsors</p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </div>
            </div>
          )
        })}
      </div>

      {missingLogoCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <ImageOff className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>
            <span className="font-semibold">{missingLogoCount} sponsor{missingLogoCount !== 1 ? "s" : ""}</span> {missingLogoCount !== 1 ? "are" : "is"} missing a logo. Run <span className="font-semibold">Backfill Logos</span> to auto-fill them, or edit each sponsor manually.
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Logo</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Tier</th>
                <th className="px-6 py-4 font-semibold">Website</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                {hasContributions && <th className="px-6 py-4 font-semibold text-right">Contribution</th>}
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={hasContributions ? 7 : 6} className="px-6 py-8 text-center text-muted-foreground">Loading sponsors...</td></tr>
              ) : sortedSponsors.length === 0 ? (
                <tr><td colSpan={hasContributions ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground">No sponsors yet. Add one to get started.</td></tr>
              ) : (
                sortedSponsors.map((sponsor) => (
                  <tr key={sponsor.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-6 py-4">
                      {sponsor.logoUrl ? (
                        <img
                          src={sponsor.logoUrl}
                          alt={sponsor.name}
                          className="h-10 w-20 object-contain rounded bg-gray-50 border border-gray-100 p-1"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="h-10 w-20 flex items-center justify-center rounded bg-gray-50 border border-gray-100">
                          <ImageOff className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{sponsor.name}</span>
                        {!sponsor.logoUrl && (
                          <Badge className="bg-amber-100 text-amber-700 border-0 shadow-none text-xs">No logo</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={`${TIER_COLORS[sponsor.tier] ?? ""} border-0 shadow-none`}>
                        {sponsor.tier}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {sponsor.websiteUrl ? (
                        <a
                          href={sponsor.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-xs max-w-[160px] truncate"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{sponsor.websiteUrl.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={sponsor.active ? "bg-emerald-100 text-emerald-800 border-0 shadow-none" : "bg-red-100 text-red-700 border-0 shadow-none"}>
                        {sponsor.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {hasContributions && (
                      <td className="px-6 py-4 text-right tabular-nums">
                        {sponsor.contributionAmount != null
                          ? <span className="font-medium text-foreground">HK${sponsor.contributionAmount.toLocaleString()}</span>
                          : <span className="text-muted-foreground italic">—</span>
                        }
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(sponsor)} className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background shadow-sm border transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(sponsor.id)} className="p-2 text-muted-foreground hover:text-rose-600 rounded bg-background shadow-sm border transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {hasContributions && totalContributions > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/20">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Contributions</td>
                  <td className="px-6 py-3 text-right font-bold text-foreground tabular-nums">HK${totalContributions.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {sponsors.length > 0 && (
          <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground flex items-center gap-3">
            <span>{activeSponsorCount} active sponsor{activeSponsorCount !== 1 ? "s" : ""} · {sponsors.length} total</span>
            <span className={`flex items-center gap-1 font-medium ${missingLogoCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              <ImageOff className="w-3.5 h-3.5" />
              {missingLogoCount} missing logo{missingLogoCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSponsor ? "Edit Sponsor" : "Add Sponsor"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Sponsor Name</label>
            <Input {...register("name")} placeholder="e.g. Acme Corporation" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Tier</label>
            <Select {...register("tier")}>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Logo</label>
            <div className="flex gap-2">
              <Input {...register("logoUrl")} placeholder="https://example.com/logo.png" className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading}
                className="shrink-0 gap-1.5"
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading…" : "Upload"}
              </Button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            {errors.logoUrl && <p className="text-xs text-destructive">{errors.logoUrl.message}</p>}
            {watchLogoUrl && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-100 flex items-center justify-center h-16">
                <img
                  src={watchLogoUrl}
                  alt="Logo preview"
                  className="max-h-12 max-w-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Upload a logo image or paste a URL directly.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Website URL</label>
            <Input {...register("websiteUrl")} placeholder="https://example.com" />
            {errors.websiteUrl && <p className="text-xs text-destructive">{errors.websiteUrl.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Contribution Amount (HKD) <span className="font-normal text-muted-foreground">— optional</span></label>
            <Input
              {...register("contributionAmount")}
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 10000"
            />
            {errors.contributionAmount && <p className="text-xs text-destructive">{errors.contributionAmount.message}</p>}
            <p className="text-xs text-muted-foreground">Enter the total HKD amount this sponsor has contributed. Used for the fundraising dashboard breakdown.</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              className="w-4 h-4 rounded border-gray-300 accent-primary"
              {...register("active")}
            />
            <label htmlFor="active" className="text-sm font-semibold cursor-pointer">
              Active (visible on the public website)
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingSponsor ? "Update Sponsor" : "Add Sponsor"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
