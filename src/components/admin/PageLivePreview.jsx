import { HomePageContent } from '../HomePageContent'
import { PagePreviewChrome } from './PagePreviewChrome'
import CompetitionsPage from '../../pages/CompetitionsPage'
import FaqPage from '../../pages/FaqPage'
import ContactPage from '../../pages/ContactPage'
import KickupsArchivePage from '../../pages/KickupsArchivePage'
import {
  SITE_SHELL_ID,
  COMPETITIONS_PAGE_ID,
  FAQ_PAGE_ID,
  CONTACT_PAGE_ID,
  SHIRT_GIVEAWAY_PAGE_ID,
} from '../../../shared/sitePageLayout.mjs'
import { useEditorSectionDrag } from '../../pageEditor/useEditorSectionDrag.js'

/**
 * Live page canvas for the site editor (header + page + sticky footer).
 */
export function PageLivePreview({
  activePage,
  pages,
  cleanPreview = false,
  selectedBlockId,
  onSelectBlock,
  onPatchHomepage,
  onPatchHomeBlock,
  onPatchCompetitions,
  onPatchSite,
  shellHighlight,
  onShellHighlight,
  onOpenSettings,
}) {
  const editorMode = !cleanPreview
  const blockOrder = pages.homepage?.blockOrder || []
  const { dragId, dropTargetId, dropPosition, startDrag, nudgeSection } = useEditorSectionDrag({
    blockOrder,
    onPatchBlockOrder: (nextOrder) => onPatchHomepage({ blockOrder: nextOrder }),
  })

  let canvas = null

  if (activePage === SITE_SHELL_ID) {
    canvas = (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-base text-stone-300">Use the header and footer above and below to edit site-wide navigation and legal copy.</p>
      </div>
    )
  } else if (activePage === 'homepage') {
    canvas = (
      <HomePageContent
        layout={pages.homepage}
        editorMode={editorMode}
        selectedBlockId={selectedBlockId}
        onSelectBlock={onSelectBlock}
        onPatchHomeBlock={onPatchHomeBlock}
        dragId={dragId}
        dropTargetId={dropTargetId}
        dropPosition={dropPosition}
        onStartDrag={startDrag}
        onNudgeSection={nudgeSection}
      />
    )
  } else if (activePage === COMPETITIONS_PAGE_ID) {
    canvas = (
      <div className={editorMode ? 'ss-page-editor-preview [&_button:not([data-editor-ui])]:pointer-events-none' : ''}>
        <CompetitionsPage
          layout={pages.competitions}
          editorMode={editorMode}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          onPatchLayout={onPatchCompetitions}
        />
      </div>
    )
  } else if (activePage === FAQ_PAGE_ID) {
    canvas = (
      <div className="ss-page-editor-preview [&_button:not([data-editor-ui])]:pointer-events-none">
        <FaqPage />
      </div>
    )
  } else if (activePage === CONTACT_PAGE_ID) {
    canvas = (
      <div className="ss-page-editor-preview [&_button:not([data-editor-ui])]:pointer-events-none">
        <ContactPage />
      </div>
    )
  } else if (activePage === SHIRT_GIVEAWAY_PAGE_ID) {
    canvas = <KickupsArchivePage layout={pages.shirt_giveaway} editorMode={editorMode} />
  }

  const showShellChrome = activePage !== SITE_SHELL_ID

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <PagePreviewChrome
        shell={pages.site}
        highlight={shellHighlight}
        editorMode={editorMode}
        selectedBlockId={selectedBlockId}
        onSelectBlock={onSelectBlock}
        onPatchShell={onPatchSite}
        onHighlight={
          editorMode && (showShellChrome || activePage === SITE_SHELL_ID)
            ? (part) => {
                onShellHighlight?.(part)
                onOpenSettings?.('shell')
              }
            : undefined
        }
        fullscreen
      >
        {canvas}
      </PagePreviewChrome>
    </div>
  )
}
