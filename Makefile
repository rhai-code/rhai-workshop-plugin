# Image URL to use all building/pushing image targets
REGISTRY ?= quay.io
REPOSITORY ?= $(REGISTRY)/eformat/rhai-workshop-plugin

IMG := $(REPOSITORY):latest
WATCHER_REPOSITORY ?= $(REGISTRY)/eformat/showroom-proxy-watcher
WATCHER_IMG := $(WATCHER_REPOSITORY):latest
PODMAN_ARGS ?=

# clean compile
compile:
	yarn run build

# Podman Login
podman-login:
	@podman login -u $(DOCKER_USER) -p $(DOCKER_PASSWORD) $(REGISTRY)

# Build the oci image no compile
podman-build-nocompile:
	podman build $(PODMAN_ARGS) . -t ${IMG} -f Containerfile

# Build the oci image
podman-build: compile
	podman build $(PODMAN_ARGS) . -t ${IMG} -f Containerfile

# Push the oci image
podman-push: podman-build
	podman push ${IMG}

# Push the oci image
podman-push-nocompile: podman-build-nocompile
	podman push ${IMG}

# Just Push the oci image
podman-push-nobuild:
	podman push ${IMG}

# ── Showroom Proxy Watcher ─────────────────────────────────────────────────

# Build the watcher image
watcher-build:
	podman build $(PODMAN_ARGS) showroom-proxy-watcher -t ${WATCHER_IMG} -f showroom-proxy-watcher/Containerfile

# Push the watcher image
watcher-push: watcher-build
	podman push ${WATCHER_IMG}

# Just push the watcher image
watcher-push-nobuild:
	podman push ${WATCHER_IMG}

# Build and push all images
all-build: podman-build watcher-build

all-push: podman-push watcher-push
