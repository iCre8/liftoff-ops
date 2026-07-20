# Fun task: Give your Nix shell a personality

The goal is to make it obvious when your terminal is inside this project's Nix development environment:

```text
[liftOff:nix] s4developer@s4developer-lx:~/engineering-projects/liftOff$
```

## Where the prefix comes from

Nix runs the `shellHook` in [`flake.nix`](./flake.nix) whenever `nix develop` opens the development shell. Bash stores the visible prompt in a variable named `PS1`, so the hook can add a project label before the existing prompt.

This project uses:

```sh
case "$-" in
  *i*)
    case "$PS1" in
      "[liftOff:nix] "*) ;;
      *) export PS1="[liftOff:nix] $PS1" ;;
    esac
    ;;
esac
```

Here is what each part does:

- `$-` contains the current Bash shell options. The letter `i` means the shell is interactive.
- `*i*)` changes the prompt only for an interactive terminal. Commands such as `nix develop --command pnpm test` and CI jobs are left alone.
- `$PS1` contains the prompt that was already configured by your terminal.
- `"[liftOff:nix] "*)` detects an existing prefix and prevents nested shells from adding it twice.
- `export PS1="[liftOff:nix] $PS1"` places the label before the original prompt.

## Try it

From the repository root, enter the environment:

```sh
nix --extra-experimental-features 'nix-command flakes' develop
```

Confirm that the prompt begins with `[liftOff:nix]`, then check that a project-only tool is available:

```sh
gcloud --version
```

Leave the environment:

```sh
exit
```

The prefix disappears because the parent shell still has its original `PS1` value.

## Make it yours

Change both occurrences of `[liftOff:nix]` in the inner `case` block. The detection text and displayed text must match. For example:

```sh
case "$PS1" in
  "[🚀 LiftOff] "*) ;;
  *) export PS1="[🚀 LiftOff] $PS1" ;;
esac
```

Exit and re-enter `nix develop` after editing `flake.nix`; an existing shell does not rerun the updated hook.

For a cyan prefix, Bash needs `\[` and `\]` around non-printing color codes so command-line wrapping still works:

```sh
case "$PS1" in
  *"[liftOff:nix] "*) ;;
  *) export PS1="\[\e[1;36m\][liftOff:nix]\[\e[0m\] $PS1" ;;
esac
```

After experimenting, validate the flake without building it:

```sh
nix --extra-experimental-features 'nix-command flakes' flake check --no-build
```

If the shell no longer opens, undo only your prompt-block edit in `flake.nix`, then run the validation command again.
