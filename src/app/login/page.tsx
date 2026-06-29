import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-[1.5rem] border border-line bg-ink-soft/80 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl">
        <p className="font-serif text-sm text-amber">EchoNote</p>
        <h1 className="mt-2 text-2xl font-semibold text-paper">回到你的回声笺</h1>
        <p className="mt-3 text-sm leading-7 text-paper-muted">输入私人密码后，继续记录那些不该丢失的一瞬。</p>
        <LoginForm />
      </section>
    </main>
  );
}
