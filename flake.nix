{
  description = "LiftOff attendance automation development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  };

  outputs = { nixpkgs, ... }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" ];
      forEachSystem = function:
        nixpkgs.lib.genAttrs supportedSystems (system: function nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forEachSystem (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            corepack
            docker-client
            docker-compose
            google-cloud-sdk
            postgresql_18
          ];

          shellHook = ''
            export COREPACK_HOME="$PWD/.nix/corepack"
            export PNPM_HOME="$PWD/.nix/pnpm"
            export PATH="$PNPM_HOME:$PATH"
            mkdir -p "$COREPACK_HOME" "$PNPM_HOME"
            for shim in pnpm pnpx yarn yarnpkg; do
              if [ -L "$PNPM_HOME/$shim" ]; then
                unlink "$PNPM_HOME/$shim"
              fi
            done
            corepack enable --install-directory "$PNPM_HOME"
            case "$-" in
              *i*)
                case "$PS1" in
                  "[liftOff:nix] "*) ;;
                  *) export PS1="[liftOff:nix] $PS1" ;;
                esac
                ;;
            esac
            echo "LiftOff dev shell: Node $(node --version), package manager pinned by package.json"
          '';
        };
      });
    };
}
