import type { Profile } from '../types/database';

export default function Avatar({
  profile,
  size,
  className = '',
}: {
  profile: Pick<Profile, 'avatar_url' | 'avatar_initials'> | null | undefined;
  size?: 'lg';
  className?: string;
}) {
  const classes = `avatar${size === 'lg' ? ' lg' : ''}${className ? ` ${className}` : ''}`;
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={classes} style={{ objectFit: 'cover' }} />;
  }
  return <div className={classes}>{profile?.avatar_initials ?? '··'}</div>;
}
