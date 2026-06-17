export default function TopNav() {
  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 gap-8 shrink-0 z-10">
      {/* Logo */}
      <span className="text-base font-semibold tracking-tight text-gray-900 select-none">
        Return Agent
      </span>

      {/* Nav tabs */}
      <nav className="flex items-center gap-1 h-full -mb-px">
        <a
          href="#"
          className="h-full flex items-center px-3 text-sm font-medium text-brand-600 border-b-2 border-brand-500"
          aria-current="page"
        >
          Returns
        </a>
      </nav>
    </header>
  )
}
