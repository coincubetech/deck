# COINCUBE pitch deck — developer tasks
#
# Run from the project root:
#   make help              list targets
#   make optimize-images   regenerate AVIF/WebP siblings for artwork/
#
# This Makefile wraps pnpm so targets work on any machine with pnpm + Node
# installed. No machine-specific paths.

PNPM ?= pnpm
NODE ?= node

.PHONY: help install optimize-images optimize-images-force clean-optimized

help:
	@echo "COINCUBE deck — make targets"
	@echo ""
	@echo "  make install              pnpm install (run once after cloning)"
	@echo "  make optimize-images      generate AVIF + WebP siblings for artwork/"
	@echo "                            (idempotent — skips files already up to date)"
	@echo "  make optimize-images-force  rebuild every sibling, ignoring mtime cache"
	@echo "  make clean-optimized      delete every generated .avif / .webp sibling"
	@echo ""

install:
	$(PNPM) install

# Regenerate optimized AVIF/WebP siblings next to every PNG/JPEG under
# artwork/. Non-destructive: the original source images are untouched.
#
# The target first ensures dependencies (including sharp) are installed,
# then invokes the script via pnpm so the local node_modules/.bin is on PATH.
optimize-images:
	@if [ ! -d node_modules/sharp ]; then \
		echo "sharp not installed — running pnpm install first..."; \
		$(PNPM) install; \
	fi
	$(PNPM) run optimize:images

optimize-images-force:
	@if [ ! -d node_modules/sharp ]; then \
		echo "sharp not installed — running pnpm install first..."; \
		$(PNPM) install; \
	fi
	$(PNPM) exec $(NODE) scripts/optimize-images.mjs --force

# Remove every generated optimized sibling. Safe: only touches .avif/.webp
# inside artwork/, never the source PNGs/JPEGs.
clean-optimized:
	@find artwork -type f \( -name '*.avif' -o -name '*.webp' \) -print -delete
