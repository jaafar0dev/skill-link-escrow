from pathlib import Path
p = Path('src/routes/auth.tsx')
t = p.read_text(encoding='utf-8')
old = '''  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await authSignUp({
      email,
      password,
      fullName: name,
      role,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created!");
    navigate({ to: "/dashboard" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await authSignIn({
      email: lEmail,
      password: lPassword,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };
'''
new = '''  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await authSignUp({
      email,
      password,
      fullName: name,
      role,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.session) persistLocalAuthSession(data.session);
    toast.success("Account created!");
    navigate({ to: "/dashboard" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await authSignIn({
      email: lEmail,
      password: lPassword,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.session) persistLocalAuthSession(data.session);
    navigate({ to: "/dashboard" });
  };
'''
if old not in t:
    raise SystemExit('Old block not found')
p.write_text(t.replace(old, new), encoding='utf-8')
print('patched')
