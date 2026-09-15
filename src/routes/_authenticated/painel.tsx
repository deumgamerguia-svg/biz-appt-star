  return (
    <div className="owner-panel relative min-h-screen overflow-x-hidden bg-[#050607] text-[#f3f4f6] lg:flex">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_0%_20%,rgba(15,48,86,0.42),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(0,70,150,0.16),transparent_34%)]" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(115deg,rgba(11,29,49,0.18),transparent_32%,transparent_70%,rgba(4,15,28,0.18))]" />
      <div aria-hidden="true" className="pointer-events-none fixed -left-40 top-1/4 z-0 size-[28rem] rounded-full bg-blue-600/[0.055] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none fixed -right-40 bottom-0 z-0 size-[30rem] rounded-full bg-cyan-400/[0.045] blur-3xl" />

      <Button type="button" variant="ghost" aria-label="Fechar menu" onClick={() => setOpen(false)} className={`${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} fixed inset-0 z-40 h-auto w-auto rounded-none bg-[#050607]/75 p-0 backdrop-blur-[2px] transition-opacity hover:bg-[#050607]/75 lg:hidden`} />
      <aside className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[82vw] flex-col border-r border-[#25282c] bg-[rgba(5,6,7,0.85)] px-5 py-4 shadow-[18px_0_55px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-[18.5rem] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:overflow-y-auto lg:px-5 lg:shadow-none">
        <Link to="/painel" onClick={beginNavigation} className="group flex h-[5.25rem] shrink-0 items-center border-b border-[#25282c] px-1">
          <img src={brandLogo.url} alt="Agenda Agora" className="h-11 w-auto max-w-[220px] object-contain object-left transition-transform duration-300 group-hover:scale-[1.01]" />
        </Link>

        <div className="border-b border-[#25282c] px-1 py-4">