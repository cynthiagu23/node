
(function() {
  dust.register("demo", body_0);

  function body_0(chk, ctx) {
    return chk.write("Hello ").reference(ctx.get(["name"], false), ctx, "h").write("! You have ").reference(ctx.get(["count"], false), ctx, "h").write(" new messages.");
  }
  body_0.__dustBody = !0;
  return body_0;
})();
	
