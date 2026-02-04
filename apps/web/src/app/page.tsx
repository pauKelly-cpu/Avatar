export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Fit Avatar</h1>
      <p>
        Create your avatar on the website, then use it in the browser extension
        on Zalando.
      </p>

      <ul>
        <li>
          <a href="/signup">Sign up</a>
        </li>
        <li>
          <a href="/login">Log in</a>
        </li>
        <li>
          <a href="/avatar">Avatar Builder</a> (placeholder)
        </li>
      </ul>
    </main>
  );
}
