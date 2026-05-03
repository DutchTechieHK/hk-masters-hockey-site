import { forwardRef, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"

type MaskedInputProps = React.InputHTMLAttributes<HTMLInputElement>

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  function MaskedInput(props, ref) {
    const [revealed, setRevealed] = useState(false)
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={revealed ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          {...props}
          className={`pr-10 ${props.className ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
          aria-label={revealed ? "Hide" : "Show"}
          tabIndex={-1}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
