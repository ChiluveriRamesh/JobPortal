import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />
        <meta name="description" content="India's most comprehensive government jobs portal — search, filter and get AI-extracted job details from official PDF notifications." />
        <meta name="keywords" content="sarkari naukri, government jobs india, sarkari job, central government jobs, state government jobs, UPSC, SSC, IBPS, RRB" />
        <meta property="og:title" content="Sarkari Naukri — India Government Jobs Portal" />
        <meta property="og:description" content="Search lakhs of government jobs across all states. Upload PDF notifications for instant AI extraction." />
        <meta property="og:type" content="website" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Display:wght@700&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
