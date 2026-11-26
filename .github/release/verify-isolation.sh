#!/usr/bin/env bash
# Checks that the `claude-dev` Linux user (the account Claude Code runs as)
# cannot reach the owner's credentials or sessions on this machine. Run it AS
# claude-dev, after the separate-user setup in
# docs/clearpass-2.0/07-infrastructure-action-plan.md:
#
#   sudo -iu claude-dev bash ~/clearpass/.github/release/verify-isolation.sh [owner] [owner-github-login]
#
# `owner` defaults to craig, `owner-github-login` to ZenFinanceHub.
# Some checks need the owner's desktop session to be running (Chrome open,
# logged in), so run it while the owner is logged in.
#
# READ-ONLY. It lists, stats and tries to open or connect; it never writes,
# never changes a setting, and never prints a secret: no file contents, no
# process command lines, no environment values. Only names, counts, modes
# and PASS/FAIL.
#
# Output: one line per check, PASS / FAIL / WARN / INFO. Exit code 0 = no FAIL.

set -uo pipefail
export LC_ALL=C

OWNER="${1:-craig}"
OWNER_GH="${2:-ZenFinanceHub}"   # the owner's GitHub login
pass=0; failn=0; warnn=0
ok()   { echo "PASS  $1"; pass=$((pass+1)); }
bad()  { echo "FAIL  $1"; failn=$((failn+1)); }
warn() { echo "WARN  $1"; warnn=$((warnn+1)); }
info() { echo "INFO  $1"; }
have() { command -v "$1" >/dev/null 2>&1; }

me=$(id -un)
OWNER_UID=$(id -u "$OWNER" 2>/dev/null) || { echo "No such user: $OWNER" >&2; exit 2; }
OWNER_HOME=$(getent passwd "$OWNER" | cut -d: -f6)
OWNER_GROUP=$(id -gn "$OWNER")
RUNDIR="/run/user/$OWNER_UID"

echo "Isolation check: running as '$me' (uid $(id -u)), owner '$OWNER' (uid $OWNER_UID)"
if [ "$me" = "$OWNER" ]; then
  echo "NOTE  Running as the owner. Results only mean something when run as claude-dev;"
  echo "      as the owner most access checks will (correctly) FAIL."
fi
echo

# --- 1. The owner's home directory -------------------------------------------
if ls -A "$OWNER_HOME" >/dev/null 2>&1; then bad "I1a can list $OWNER_HOME"; else ok "I1a cannot list $OWNER_HOME"; fi
if [ -x "$OWNER_HOME" ]; then
  warn "I1b can traverse $OWNER_HOME (o+x or shared group); every file below relies on its own permissions"
else
  ok "I1b cannot traverse $OWNER_HOME"
fi
info "I1c $OWNER_HOME mode: $(stat -c '%A %U:%G' "$OWNER_HOME" 2>/dev/null || echo unknown)"

# Credentials and sessions that must be unreachable. -r on the path, and for
# directories also a listing attempt. Paths that do not exist count as
# unreachable either way; the result line does not say which.
sensitive=(
  .config/gh .config/gh/hosts.yml .git-credentials .gitconfig
  .config/clearpass .config/clearpass/db.env clearpass-backups
  .expo .expo/state.json .eas
  .ssh .gnupg .local/share/keyrings .password-store
  .config/google-chrome .config/chromium snap/chromium .mozilla/firefox snap/firefox/common/.mozilla/firefox
  .claude .claude.json .config/Code .vscode
  .npmrc .docker/config.json .aws .config/gcloud .kube .cloudflared .wrangler .config/.wrangler
  .bash_history .zsh_history .netrc .pgpass
)
leaks=()
for rel in "${sensitive[@]}"; do
  p="$OWNER_HOME/$rel"
  if [ -r "$p" ] || ls -A "$p" >/dev/null 2>&1; then leaks+=("$rel"); fi
done
if [ "${#leaks[@]}" -eq 0 ]; then
  ok "I1d none of ${#sensitive[@]} credential/browser/session paths in $OWNER_HOME is readable (gh, git, clearpass db.env, Expo, ssh, gpg, keyrings, Chrome, Chromium, Firefox, Claude, cloud CLIs, histories)"
else
  bad "I1d readable under $OWNER_HOME: ${leaks[*]}"
fi
if id -nG "$me" | tr ' ' '\n' | grep -qx "$OWNER_GROUP"; then bad "I1e $me is in the owner's group '$OWNER_GROUP'"; else ok "I1e $me is not in the owner's group '$OWNER_GROUP'"; fi

# --- 2. Owner's runtime dir: D-Bus, keyring, ssh-agent, Wayland, ... ----------
if [ -x "$RUNDIR" ] || ls -A "$RUNDIR" >/dev/null 2>&1; then
  bad "I2a can enter $RUNDIR ($(stat -c '%A' "$RUNDIR" 2>/dev/null))"
else
  ok "I2a cannot enter $RUNDIR (session bus, keyring, ssh-agent, gpg-agent, Wayland, PipeWire sockets are below it)"
fi
reach=()
for s in bus keyring/control keyring/ssh openssh_agent gnupg/S.gpg-agent gnupg/S.gpg-agent.ssh wayland-0 wayland-1 pipewire-0 pulse/native cc-socks; do
  if [ -e "$RUNDIR/$s" ] && { [ -r "$RUNDIR/$s" ] || [ -w "$RUNDIR/$s" ]; }; then reach+=("$s"); fi
done
if [ "${#reach[@]}" -eq 0 ]; then ok "I2b no session socket under $RUNDIR is reachable (bus, keyring, ssh/gpg agents, Wayland, PipeWire, Claude Code)"; else bad "I2b reachable under $RUNDIR: ${reach[*]}"; fi
if have dbus-send; then
  if timeout 5 dbus-send --bus="unix:path=$RUNDIR/bus" --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.GetId >/dev/null 2>&1; then
    bad "I2c connected to the owner's D-Bus session bus"
  else
    ok "I2c cannot connect to the owner's D-Bus session bus"
  fi
else
  info "I2c dbus-send not installed; D-Bus covered by I2a only"
fi
if have ssh-add; then
  agent_ok=0
  for sock in "$RUNDIR/openssh_agent" "$RUNDIR/keyring/ssh" "$RUNDIR/gnupg/S.gpg-agent.ssh"; do
    # ssh-add -l: 0 = listed keys, 1 = agent answered but has no keys,
    # 2 = could not connect. Only 2 means unreachable. Output discarded.
    SSH_AUTH_SOCK="$sock" timeout 5 ssh-add -l >/dev/null 2>&1
    rc=$?
    if [ "$rc" -eq 0 ] || [ "$rc" -eq 1 ]; then agent_ok=1; fi
  done
  if [ "$agent_ok" = 0 ]; then ok "I2d cannot talk to the owner's ssh-agent"; else bad "I2d the owner's ssh-agent answered"; fi
fi
for v in DBUS_SESSION_BUS_ADDRESS SSH_AUTH_SOCK WAYLAND_DISPLAY XDG_RUNTIME_DIR GNOME_KEYRING_CONTROL; do
  val="${!v:-}"
  if [ -n "$val" ] && [[ "$val" == *"/run/user/$OWNER_UID"* || "$val" == *"$OWNER_HOME"* ]]; then
    bad "I2e $v in this shell points into the owner's session"
  fi
done

# --- 3. X11 --------------------------------------------------------------------
# The socket file needs write permission to connect, but Xorg/Xwayland also
# listen on an ABSTRACT socket (@/tmp/.X11-unix/Xn), which has no file
# permissions: any local user can connect to it. What then protects the
# display is X access control (MIT cookie / xhost). So: report reachability,
# then try a harmless query without the owner's cookie.
shopt -s nullglob
xsockets=(/tmp/.X11-unix/X*)
shopt -u nullglob
if [ "${#xsockets[@]}" -eq 0 ]; then
  info "I3 no X11 sockets in /tmp/.X11-unix"
fi
for xs in "${xsockets[@]}"; do
  n="${xs##*/X}"
  fs="no"; [ -w "$xs" ] && fs="yes"
  abs="no"; grep -qF "@/tmp/.X11-unix/X$n" /proc/net/unix 2>/dev/null && abs="yes"
  info "I3a display :$n - socket file $(stat -c '%A %U' "$xs") (writable by $me: $fs); abstract socket @/tmp/.X11-unix/X$n listening: $abs"
  if have xhost; then
    if out=$(DISPLAY=":$n" XAUTHORITY=/nonexistent timeout 5 xhost 2>&1); then
      bad "I3b X server :$n ADMITS $me without the owner's cookie. Its access list: $(echo "$out" | tr '\n' ';')"
    else
      ok "I3b X server :$n refuses $me ($(echo "$out" | head -1 | cut -c1-80))"
    fi
  else
    if [ "$fs" = yes ] || [ "$abs" = yes ]; then warn "I3b display :$n is reachable and xhost is not installed, so X access control could not be tested"; fi
  fi
done
if [ -n "${DISPLAY:-}" ] || [ -n "${XAUTHORITY:-}" ]; then
  warn "I3c DISPLAY/XAUTHORITY are set in this shell (names only); claude-dev should not inherit the owner's display"
fi

# --- 4. Groups, Docker, sudo -------------------------------------------------
groups_now=" $(id -nG "$me") "
for g in sudo admin wheel docker adm lxd libvirt disk shadow; do
  if [[ "$groups_now" == *" $g "* ]]; then bad "I4a $me is in group '$g'"; fi
done
[[ "$groups_now" =~ \ (sudo|admin|wheel|docker|adm|lxd|libvirt|disk|shadow)\  ]] || ok "I4a not in sudo/admin/wheel/docker/adm/lxd/libvirt/disk/shadow (groups:$groups_now)"
for sock in /var/run/docker.sock /run/docker.sock; do
  [ -S "$sock" ] || continue
  if [ -w "$sock" ] || [ -r "$sock" ]; then bad "I4b $sock is accessible (root-equivalent)"
  elif have curl && curl -s -m 5 --unix-socket "$sock" http://localhost/_ping >/dev/null 2>&1; then bad "I4b the system Docker daemon answered on $sock"
  else ok "I4b cannot use the system Docker socket $sock"; fi
done
if [ -n "${DOCKER_HOST:-}" ]; then
  case "$DOCKER_HOST" in
    *"/run/user/$(id -u)/"*) ok "I4c DOCKER_HOST points at $me's own rootless daemon" ;;
    *) bad "I4c DOCKER_HOST is not $me's rootless socket" ;;
  esac
else
  info "I4c DOCKER_HOST unset (rootless Docker normally sets it to unix:///run/user/$(id -u)/docker.sock)"
fi
if have sudo; then
  if sudo -n true >/dev/null 2>&1; then bad "I4d 'sudo -n true' succeeded"; else ok "I4d 'sudo -n true' is refused"; fi
fi

# --- 5. /proc hidepid -----------------------------------------------------------
hp=$(awk '$2=="/proc" && $3=="proc" {print $4}' /proc/mounts | tr ',' '\n' | grep -E '^hidepid=' | head -1)
info "I5a /proc mount option: ${hp:-hidepid not set (default: everyone sees every process)}"
seen=0; cmd=0; envr=0
for d in /proc/[0-9]*; do
  [ "$(stat -c %u "$d" 2>/dev/null)" = "$OWNER_UID" ] || continue
  seen=$((seen+1))
  # Size only; the command line itself is never printed.
  if [ -r "$d/cmdline" ] && [ -n "$(tr -d '\0' < "$d/cmdline" 2>/dev/null | head -c 1)" ]; then cmd=$((cmd+1)); fi
  if [ -r "$d/environ" ] && head -c 1 "$d/environ" >/dev/null 2>&1; then envr=$((envr+1)); fi
done
if [ "$me" != "$OWNER" ] && [ "$cmd" -gt 0 ]; then
  bad "I5b $me can see $seen of the owner's processes and read $cmd command lines. Any secret passed as a command-line argument is visible. Fix: mount /proc with hidepid=invisible (see the note at the end)"
elif [ "$me" != "$OWNER" ] && [ "$seen" -gt 0 ]; then
  warn "I5b $me can see $seen owner processes (not their command lines)"
else
  ok "I5b owner processes visible: $seen; readable command lines: $cmd"
fi
if [ "$me" != "$OWNER" ] && [ "$envr" -gt 0 ]; then bad "I5c can read the environment of $envr owner processes"; else [ "$me" != "$OWNER" ] && ok "I5c cannot read the environment of any owner process"; fi

# --- 6. Credential-looking files in shared temp dirs -------------------------
pattern='(token|secret|credential|passw|apikey|api_key|private|\.pem$|\.key$|\.p12$|\.pfx$|^\.env|db\.env|cookie|id_rsa|id_ed25519|kubeconfig|npmrc|hosts\.yml|netrc|pgpass|service-account|auth\.json|storage-?state|keyring)'
# A file only leaks if every directory above it is also enterable by others.
others_can_reach() {
  local d="${1%/*}"
  while [ -n "$d" ] && [ "$d" != / ]; do
    [ "$(( 0$(stat -c %a "$d") & 01 ))" -ne 0 ] || return 1
    d="${d%/*}"
  done
}
found=(); total=0
while IFS= read -r -d '' f; do
  others_can_reach "$f" || continue
  total=$((total+1))
  base="${f##*/}"
  if grep -qiE "$pattern" <<< "$base"; then found+=("$f"); fi
done < <(find /tmp /var/tmp /dev/shm -xdev -maxdepth 6 -user "$OWNER" -type f -perm -o=r -print0 2>/dev/null)
if [ "${#found[@]}" -eq 0 ]; then
  ok "I6 no world-readable owner files with credential-like names in /tmp, /var/tmp, /dev/shm ($total world-readable owner files reachable in total; review them if that is unexpected)"
else
  bad "I6 world-readable owner files with credential-like names (names only):"
  printf '        %s\n' "${found[@]}"
fi

# --- 7. Claude in Chrome native-messaging bridge -----------------------------
# Chrome starts the native host (~/.claude/chrome/chrome-native-host, from
# NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json) as
# the owner; it listens on /tmp/claude-mcp-browser-bridge-<user>/<pid>.sock,
# which Claude Code's browser MCP connects to. Cross-user access would let
# claude-dev drive the owner's logged-in browser.
bridge="/tmp/claude-mcp-browser-bridge-$OWNER"
if [ -e "$bridge" ]; then
  bown=$(stat -c %U "$bridge"); bmode=$(stat -c %a "$bridge")
  if [ "$bown" != "$OWNER" ]; then
    bad "I7a $bridge is owned by '$bown', not $OWNER (squatted: whoever owns it can intercept the owner's browser bridge)"
  elif [ -x "$bridge" ] || ls -A "$bridge" >/dev/null 2>&1; then
    bad "I7a can enter $bridge (mode $bmode)"
  else
    ok "I7a browser bridge dir $bridge is $OWNER's, mode $bmode, not enterable"
  fi
else
  warn "I7a $bridge does not exist right now (Chrome not running?). /tmp is shared, so another user could create it first; re-run while Chrome is open, and after a reboot check that it is owned by $OWNER"
fi
# Any other bridge or Claude temp dir that belongs to the owner's name/uid but not to the owner.
for d in /tmp/claude-mcp-browser-bridge-"$OWNER"* /tmp/claude-"$OWNER_UID"; do
  [ -e "$d" ] || continue
  [ "$(stat -c %U "$d")" = "$OWNER" ] || bad "I7b $d is not owned by $OWNER"
done
if [ -e "/tmp/claude-$OWNER_UID" ]; then
  if [ -x "/tmp/claude-$OWNER_UID" ]; then bad "I7c can enter /tmp/claude-$OWNER_UID (the owner's Claude Code temp dir)"; else ok "I7c cannot enter /tmp/claude-$OWNER_UID (the owner's Claude Code temp dir)"; fi
fi
bridges_reachable=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  case "$path" in /tmp/claude-mcp-browser-bridge-*) ;; *) continue ;; esac
  [ -w "$path" ] && [[ "$path" != /tmp/claude-mcp-browser-bridge-"$me"/* ]] && bridges_reachable=$((bridges_reachable+1))
done < <(awk 'NR>1 && $NF ~ /^\// {print $NF}' /proc/net/unix 2>/dev/null | sort -u)
if [ "$bridges_reachable" -gt 0 ]; then bad "I7d $bridges_reachable browser-bridge socket(s) of another user are writable by $me"; else ok "I7d no other user's browser-bridge socket is reachable"; fi

# --- 8. This user's own environment ------------------------------------------
check_env_names() { # $1 = label, stdin = NAME=VALUE lines; prints offending NAMES only
  grep -oE '^(GH_TOKEN|GITHUB_TOKEN|GH_ENTERPRISE_TOKEN|GITHUB_PAT|EXPO_TOKEN|SUPABASE[A-Z0-9_]*|CLOUDFLARE[A-Z0-9_]*|CF_API_TOKEN|DATABASE_URL|PGPASSWORD|NPM_TOKEN|AWS_SECRET_ACCESS_KEY|RELEASE_APP_PRIVATE_KEY)=' | tr -d '=' | sort -u | tr '\n' ' '
}
names=$(env | check_env_names)
if [ -z "$names" ]; then ok "I8a this shell has none of GH_TOKEN/GITHUB_TOKEN/EXPO_TOKEN/SUPABASE*/CLOUDFLARE*/DATABASE_URL/PGPASSWORD/NPM_TOKEN"; else bad "I8a this shell has: $names"; fi
login_names=$(env -i HOME="$HOME" USER="$me" PATH=/usr/bin:/bin bash -lc env 2>/dev/null | check_env_names)
if [ -z "$login_names" ]; then ok "I8b a fresh login shell of $me sets none of them either"; else bad "I8b $me's login shell sets: $login_names"; fi
if have gh; then
  acct=$(gh auth status 2>&1 | grep -oE 'account [A-Za-z0-9-]+' | awk '{print $2}' | sort -u | tr '\n' ' ')
  if grep -qw "$OWNER_GH" <<< "$acct"; then bad "I8c gh CLI is logged in as the owner account"; else info "I8c gh CLI accounts for $me: ${acct:-none}"; fi
fi

echo
echo "Result: $pass passed, $failn failed, $warnn warnings"
if [ -z "$hp" ]; then
  cat <<'NOTE'

Note on /proc (I5): without hidepid, every local user can read every
process's command line (not its environment). Recommended, as root:
  mount -o remount,hidepid=invisible /proc
and to persist it, add to /etc/fstab:
  proc  /proc  proc  defaults,hidepid=invisible  0  0
On a GNOME desktop some system services (polkit, systemd-logind helpers)
need to see other users' processes; if anything misbehaves, create a group
for them and add `gid=<that group>` to the options. Either way, keep
passing secrets via files or environment variables, never as command-line
arguments.
NOTE
fi
[ "$failn" -eq 0 ]
