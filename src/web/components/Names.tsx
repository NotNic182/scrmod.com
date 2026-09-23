/** A list of player names in running text, each isolated so a right-to-left name can't pull the separators around. */
export function Names({ names, sep }: { names: string[] | null | undefined; sep: string }) {
  return (
    <>
      {(names ?? []).map((n, i) => (
        <span key={i}>
          {i ? sep : null}
          <bdi>{n}</bdi>
        </span>
      ))}
    </>
  )
}
