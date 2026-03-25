/**
 * CJS-compatible mock for react-markdown (ESM-only in production).
 * Renders children as-is so that unit tests can assert on raw markdown text
 * without needing a full unified/remark/rehype pipeline.
 */
import React from 'react'

type Props = {
  children?: React.ReactNode
  rehypePlugins?: unknown[]
  components?: Record<string, unknown>
}

export default function ReactMarkdown({ children }: Props): React.JSX.Element {
  return <>{children}</>
}
