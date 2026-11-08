// Relative, not the '@/' alias: the root type-check reads this file and does not know the alias.
import type { Role } from '../api/types';
import { realEstate } from '../profile/real-estate';
import type { TenantProfile } from '../profile/types';

export interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

/**
 * One declaration of who may see what. The navigation renders from this and the
 * route guard reads the same list, so a link and its guard cannot disagree.
 * Labels come from the tenant profile; hrefs and roles never do.
 *
 * Hiding a link is presentation. The guard is the control.
 */
export function navItems(profile: TenantProfile = realEstate): NavItem[] {
  const { terms } = profile;
  const items: NavItem[] = [
    { href: '/leads', label: 'Queue', roles: ['salesperson'] },
    { href: '/manage', label: 'Overview', roles: ['manager', 'admin'] },
    { href: '/leads', label: terms.leads, roles: ['manager', 'admin'] },
    { href: '/manage/salespeople', label: terms.people, roles: ['manager', 'admin'] },
    { href: '/manage/projects', label: terms.places, roles: ['manager', 'admin'] },
    { href: '/manage/users', label: 'Users', roles: ['admin'] },
    { href: '/notifications', label: 'Notifications', roles: ['salesperson', 'manager', 'admin'] },
  ];
  // The reservations screen exists for hospitality tenants only. Hiding the link is
  // presentation; the screen's own layout guard is the control.
  if (profile.features.reservations) {
    items.splice(items.findIndex((item) => item.href === '/notifications'), 0, {
      href: '/reservations',
      label: 'Reservations',
      roles: ['salesperson', 'manager', 'admin'],
    });
  }
  // Appointments exist for clinic tenants only, on the same terms as reservations.
  if (profile.features.appointments) {
    items.splice(items.findIndex((item) => item.href === '/notifications'), 0, {
      href: '/appointments',
      label: 'Appointments',
      roles: ['salesperson', 'manager', 'admin'],
    });
  }
  return items;
}

export function navFor(role: Role, profile: TenantProfile = realEstate): NavItem[] {
  return navItems(profile).filter((item) => item.roles.includes(role));
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  return role === 'salesperson' ? '/leads' : '/manage';
}

export function canAccess(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}
