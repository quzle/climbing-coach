import { redirect } from 'next/navigation'

/**
 * @description Legacy setup route retained only for backward-compatible links.
 * Redirects to the in-app programme builder now that manual setup is obsolete.
 */
export default function ProgrammeSetupPage(): never {
  redirect('/programme')
}
