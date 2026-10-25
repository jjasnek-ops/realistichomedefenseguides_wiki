export function GET() {
  const value = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID ?? "";
  const publisher = value.replace(/^ca-/, "");
  const valid = /^pub-\d{16}/.test(publisher) && publisher.length === 20;
  const line = "google.com, " + publisher + ", DIRECT, f08c47fec0942fa0\n";
  return new Response(valid ? line : "", {
    status: valid ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
