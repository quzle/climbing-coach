import {
  createAuthenticatedAnonClient,
  createIntegrationHarness,
  type IntegrationTestUser,
} from '@/test/integration/supabase-test-harness'

describe('Supabase RLS integration', () => {
  const harness = createIntegrationHarness('rls')

  let alice: IntegrationTestUser
  let bob: IntegrationTestUser

  beforeAll(async () => {
    await harness.assertConnectivity()
    alice = await harness.createUser({ label: 'alice' })
    bob = await harness.createUser({ label: 'bob' })

    await harness.insertProgramme(alice.id, 'Alice programme')
    await harness.insertProgramme(bob.id, 'Bob programme')
    await harness.insertChatThread(alice.id, 'Alice thread')
    await harness.insertChatThread(bob.id, 'Bob thread')
  })

  afterAll(async () => {
    await harness.cleanup()
  })

  it('filters programmes to the authenticated owner', async () => {
    const aliceClient = createAuthenticatedAnonClient(alice.session)

    const ownResult = await aliceClient.from('programmes').select('name, user_id').eq('user_id', alice.id)
    const crossUserResult = await aliceClient.from('programmes').select('name, user_id').eq('user_id', bob.id)

    expect(ownResult.error).toBeNull()
    expect(ownResult.data).toEqual([
      expect.objectContaining({
        name: 'Alice programme',
        user_id: alice.id,
      }),
    ])

    expect(crossUserResult.error).toBeNull()
    expect(crossUserResult.data).toEqual([])
  })

  it('filters profiles to the authenticated owner', async () => {
    const aliceClient = createAuthenticatedAnonClient(alice.session)

    const ownProfile = await aliceClient.from('profiles').select('id, email').eq('id', alice.id).maybeSingle()
    const crossUserProfile = await aliceClient.from('profiles').select('id, email').eq('id', bob.id).maybeSingle()

    expect(ownProfile.error).toBeNull()
    expect(ownProfile.data).toEqual(
      expect.objectContaining({
        id: alice.id,
        email: alice.email,
      }),
    )

    expect(crossUserProfile.error).toBeNull()
    expect(crossUserProfile.data).toBeNull()
  })

  it('filters chat threads to the authenticated owner', async () => {
    const aliceClient = createAuthenticatedAnonClient(alice.session)

    const ownThreads = await aliceClient.from('chat_threads').select('title, user_id').eq('user_id', alice.id)
    const crossUserThreads = await aliceClient.from('chat_threads').select('title, user_id').eq('user_id', bob.id)

    expect(ownThreads.error).toBeNull()
    expect(ownThreads.data).toEqual([
      expect.objectContaining({
        title: 'Alice thread',
        user_id: alice.id,
      }),
    ])

    expect(crossUserThreads.error).toBeNull()
    expect(crossUserThreads.data).toEqual([])
  })
})