import Link from "next/link";

// Skeleton: a friend's PiggyBank (read-only + encouragement).
export default async function FriendDetailScreen({
  params,
}: PageProps<"/friends/[id]">) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <Link href="/friends" className="text-sm text-neutral-400">
        ← Friends
      </Link>

      <header>
        <h1 className="text-xl font-bold">Friend: {id}</h1>
        <p className="text-sm text-neutral-500">[ their PiggyBank progress ]</p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">[ goal · progress · on-pace status ]</p>
      </section>

      <button className="rounded-lg border border-neutral-200 p-4 text-sm" type="button">
        👏 Cheer them on
      </button>
    </div>
  );
}
