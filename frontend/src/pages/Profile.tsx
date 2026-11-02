import { useAuth } from '@/contexts/AuthContext';
import { Avatar, SectionHeader } from '@/components/common/ui';
import { ChangePasswordCard } from '@/components/common/ChangePasswordCard';
import { UserCircle2 } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader title="Profile" icon={<UserCircle2 className="h-5 w-5" />} />
      <div className="card card-pad flex items-center gap-4">
        <Avatar name={user.name} color={user.avatar_color} size={56} />
        <div>
          <p className="text-lg font-bold">{user.name}</p>
          <p className="text-sm text-subtle">{user.email} · {user.role}</p>
        </div>
      </div>
      <ChangePasswordCard />
    </div>
  );
}
