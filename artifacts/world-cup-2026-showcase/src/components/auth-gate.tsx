import { useState, useEffect, ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Archive, Lock, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AuthGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('hkm_admin_session'))
  const [isVerifying, setIsVerifying] = useState(true)
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const handleExpired = () => {
      setToken(null)
      localStorage.removeItem('hkm_admin_session')
    }
    window.addEventListener('hkm:session-expired', handleExpired)
    return () => window.removeEventListener('hkm:session-expired', handleExpired)
  }, [])

  useEffect(() => {
    let mounted = true
    
    const verifySession = async () => {
      if (!token) {
        if (mounted) setIsVerifying(false)
        return
      }
      
      try {
        const res = await fetch('/api/admin/auth', {
          headers: { 'x-session-token': token }
        })
        
        if (!res.ok) {
          throw new Error('Invalid token')
        }
        const data = await res.json()
        if (!data.authenticated) {
          throw new Error('Invalid token')
        }
      } catch (err) {
        if (mounted) {
          setToken(null)
          localStorage.removeItem('hkm_admin_session')
        }
      } finally {
        if (mounted) setIsVerifying(false)
      }
    }
    
    verifySession()
    
    return () => {
      mounted = false
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      
      if (!res.ok) {
        throw new Error('Invalid access code')
      }
      
      const data = await res.json()
      if (data.token) {
        localStorage.setItem('hkm_admin_session', data.token)
        setToken(data.token)
      } else {
        throw new Error('No token returned')
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: err.message || "Invalid access code."
      })
    } finally {
      setIsSubmitting(false)
      setPassword("")
    }
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-serif">Verifying archive access...</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pattern-dots opacity-50" />
        
        <Card className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Archive className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-serif">Historical Archive</CardTitle>
              <CardDescription className="text-sm">
                World Cup 2026 Showcase
              </CardDescription>
            </div>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <input
                aria-hidden="true"
                autoComplete="username"
                className="sr-only"
                name="username"
                readOnly
                tabIndex={-1}
                value="club-admin"
              />
              <div className="bg-secondary/50 border border-border rounded-lg p-4 text-sm text-muted-foreground flex gap-3">
                <Lock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <p>
                  This private historical archive uses the same club admin access password to restrict viewing. 
                  Your credentials are never persisted.
                </p>
              </div>
              
              <div className="space-y-2">
                <label
                  htmlFor="showcase-access-password"
                  className="text-sm font-medium text-foreground"
                >
                  Club admin password
                </label>
                <Input
                  id="showcase-access-password"
                  type="password"
                  placeholder="Enter club admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="font-sans"
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full font-serif text-lg tracking-wide" 
                disabled={isSubmitting || !password.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Access Archive
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
