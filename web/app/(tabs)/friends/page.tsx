import Link from "next/link";

// Skeleton: Friends — social feed + pending early-exit approvals.
export default function FriendsScreen() {
  const friends = [
    { id: "ana", name: "Ana" },
    { id: "luis", name: "Luis" },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-xl font-bold">Friends</h1>
        <p className="text-sm text-neutral-500">Amigos</p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">Pending approvals</p>
        <p className="text-sm text-neutral-500">
          [ a friend asked to unlock early — approve or decline ]
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">Friends' activity</p>
        {friends.map((f) => (
          <Link
            key={f.id}
            href={`/friends/${f.id}`}
            className="rounded-lg border border-neutral-200 p-4 text-sm"
          >
            👤 {f.name} <span className="text-neutral-400">[ recent PiggyBank activity ]</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
