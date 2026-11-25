/* ---------------------------------------------------------------------
   Writing in a text: the rich-text commands of the toolbar, a colour
   taken over a selection, the hex box's selection kept while it is open,
   and the note's commit. Taken out of 25-figures.js (0.27.2): a reader
   reads text and never writes it, and on the site this is in the
   editor's file (LAZY_PARTS).
   ------------------------------------------------------------------ */
/* A reading is ONE thing, however many characters it covers.
 *
 * Formatting works on a range, and a range can end in the middle of a word
 * — including in the middle of the word a reading sits over. Colouring
 * `Upri` out of `[[Uprising|reading]]` made the browser split the <ruby>
 * in two so that each half could carry its own colour, and what came back
 * out was a reading over `Upri` followed by the loose letters `s` and
 * `ing`: the word came apart under a mark that is supposed to be attached
 * to the whole of it.
 *
 * So a range that starts or ends inside a reading is widened to take the
 * whole of it. The reading then takes the formatting as a unit, which is
 * also the only thing the markup can express. */
function widenOverRuby(surface, range){
  if(!range) return range;
  const halfOf = (node)=>{
    const e = node && (node.nodeType === 1 ? node : node.parentElement);
    if(!e || !e.closest) return null;
    const r = e.closest('ruby');
    if(!r || !surface.contains(r)) return null;
    return {ruby: r, anno: !!e.closest('rt')};
  };
  const h1 = halfOf(range.startContainer), h2 = halfOf(range.endContainer);
  if(!h1 && !h2) return range;
  /* A selection lying wholly within ONE half of one reading is left alone.
     Both halves are markup in their own right now, so formatting part of a
     base — or an annotation on its own, which is the whole point — is
     something the stored form can say. Only a selection that straddles the
     two, or runs out of the reading entirely, is widened: that is the case
     the browser answers by splitting the <ruby> in two, which came back
     out as a reading over the first half and loose letters after it. */
  if(h1 && h2 && h1.ruby === h2.ruby && h1.anno === h2.anno) return range;
  const a = h1 && h1.ruby, b = h2 && h2.ruby;
  const wide = range.cloneRange();
  if(a) wide.setStartBefore(a);
  if(b) wide.setEndAfter(b);
  const sel = window.getSelection && window.getSelection();
  if(sel){ sel.removeAllRanges(); sel.addRange(wide); }
  return wide;
}
// Applies a formatting command to whichever rich surface has focus.
/* A colour put on words is THE colour of those words, whatever they wore.
 *
 * Wrapping them in a new span left any colour around them or inside them
 * where it was, and the stored markup keeps one colour per run — the
 * outermost — so a second colour on the same words was nested inside the
 * first and lost on the way out: colouring words twice did nothing. Now
 * colours inside the new run are taken off, and a coloured run around it
 * is split, keeping its colour on either side and not over these words. */
function carriesColour(el){
  return el.nodeType === 1 &&
    (!!(el.style && el.style.color) || (el.tagName === 'FONT' && el.hasAttribute('color')));
}
function dropColour(el){
  if(el.style) el.style.removeProperty('color');
  if(el.tagName === 'FONT') el.removeAttribute('color');
  // A span or font left with nothing to say is let go of altogether.
  const bare = (el.tagName === 'SPAN' || el.tagName === 'FONT') &&
    Array.from(el.attributes).every(at=> at.name === 'style' && !at.value.trim());
  if(bare && el.parentNode){
    while(el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
    el.parentNode.removeChild(el);
  }
}
function takeColourOver(span, surface){
  Array.from(span.querySelectorAll('*')).filter(carriesColour).forEach(dropColour);
  for(let a = span.parentNode; a && a !== surface && surface.contains(a); ){
    const up = a.parentNode;
    if(carriesColour(a)){
      const side = (start)=>{
        const r = document.createRange();
        if(start){ r.setStart(a, 0); r.setEndBefore(span); }
        else { r.setStartAfter(span); r.setEnd(a, a.childNodes.length); }
        const frag = r.extractContents();
        if(!frag.textContent) return null;
        const twin = a.cloneNode(false);
        twin.appendChild(frag);
        return twin;
      };
      const before = side(true), after = side(false);
      if(before) up.insertBefore(before, a);
      if(after) up.insertBefore(after, a.nextSibling);
      dropColour(a);
    }
    a = up;
  }
}
/* The parts of a selection that lie in each of a field's lines, when it
   lies in more than one: null otherwise. Lines whose part holds nothing
   are left out. */
function linePartsOf(surface, range){
  const isLine = (n)=> n && n.nodeType === 1 && n.parentNode === surface && /^(DIV|P)$/.test(n.tagName);
  const lineOf = (c, off, end)=>{
    if(c === surface) return surface.childNodes[end ? off - 1 : off] || null;
    while(c && c.parentNode !== surface) c = c.parentNode;
    return c;
  };
  const a = lineOf(range.startContainer, range.startOffset, false);
  const b = lineOf(range.endContainer, range.endOffset, true);
  if(!a || !b || a === b || !isLine(a) || !isLine(b)) return null;
  const parts = [];
  for(let n = a; n; n = n.nextSibling){
    if(isLine(n)){
      const r = document.createRange();
      r.selectNodeContents(n);
      if(n === a && range.startContainer !== surface) r.setStart(range.startContainer, range.startOffset);
      if(n === b && range.endContainer !== surface) r.setEnd(range.endContainer, range.endOffset);
      if(!r.collapsed && (r.toString() || r.cloneContents().querySelector('[data-sticker], [data-ref], [data-media]'))) parts.push(r);
    }
    if(n === b) break;
  }
  return parts.length ? parts : null;
}
/* A run's look put round a selection that crosses lines. A field's lines
   are blocks, and a span round two of them is an inline holding blocks:
   the browser lays that out with an empty line box before and after each
   block, so ruling three lines in the in-entry editor pushed them apart,
   and taking the rule off left the span, and the gaps, where they were
   until the field was closed (the owner's list of 15.11). Each line's
   words get a wrapper of their own instead, a copy of `wrap`, and the
   lines stay lines. Returns what to insert. */
function wrapInlineRuns(frag, wrap){
  const isBlock = (n)=> n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName);
  if(!Array.from(frag.childNodes).some(isBlock)){ wrap.appendChild(frag); return wrap; }
  let run = null;
  Array.from(frag.childNodes).forEach(n=>{
    if(isBlock(n)){
      run = null;
      if(!n.textContent && !n.querySelector('[data-sticker], [data-ref], [data-media]')) return;
      const w = wrap.cloneNode(false);
      while(n.firstChild) w.appendChild(n.firstChild);
      n.appendChild(w);
      return;
    }
    if(!run){ run = wrap.cloneNode(false); frag.insertBefore(run, n); }
    run.appendChild(n);
  });
  return frag;
}
function applyRichCommand(surface, kind, arg, restyle, hadAll){
  surface.focus({preventScroll:true});
  // Ask for tags rather than inline styles, so what comes back out is
  // <b>/<i> and maps straight onto the stored markup.
  try{ document.execCommand('styleWithCSS', false, false); }catch(e){}
  /* Every command below reads the live selection for itself, so widening
     it here reaches all of them — bold and italic included, which go
     through execCommand and would otherwise split a reading just as
     colouring did. */
  {
    const sel0 = window.getSelection && window.getSelection();
    if(sel0 && sel0.rangeCount){
      const r0 = sel0.getRangeAt(0);
      if(!r0.collapsed && surface.contains(r0.commonAncestorContainer)) widenOverRuby(surface, r0);
    }
  }
  /* A list is the browser's own, so its Enter and Backspace carry on and
     leave it the way they do in every editor; pressed again over a list,
     the same button takes it off. */
  if(kind === 'ul' || kind === 'ol'){
    document.execCommand(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
    tidyNoteLists(surface);
    return;
  }
  if(kind === 'bold'){ document.execCommand('bold'); return; }
  if(kind === 'italic'){ document.execCommand('italic'); return; }
  /* Taking a colour OFF. There is no execCommand for "inherit", so the
     colour is stripped from the elements the selection actually covers.
     Without this a coloured run was permanent: an amalgam paints its label
     from its own border gradient, and a run given a flat colour could
     never be handed back to it. */
  /* Size, exactly as face: strip whatever the selection already carries,
     then wrap it in the new one. Kept separate from the face branch only
     because the two are independent — a run can be set in one face at one
     size, and changing either must leave the other alone. */
  if(kind === 'size' || kind === 'unsize'){
    const sel = window.getSelection && window.getSelection();
    if(!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if(range.collapsed || !surface.contains(range.commonAncestorContainer)) return;
    const frag = range.extractContents();
    const strip = (node)=>{
      Array.from(node.childNodes).forEach(child=>{
        if(child.nodeType !== 1) return;
        strip(child);
        const elx = child;
        if(!sizeOfEl(elx)) return;
        if(elx.dataset) delete elx.dataset.size;
        if(elx.style) elx.style.removeProperty('font-size');
        const bare = elx.tagName === 'SPAN' &&
          (!elx.getAttribute('style') || !elx.getAttribute('style').trim()) &&
          !elx.getAttribute('data-font') && !elx.getAttribute('data-size');
        if(bare){
          while(elx.firstChild) node.insertBefore(elx.firstChild, elx);
          node.removeChild(elx);
        }
      });
    };
    strip(frag);
    if(kind === 'size'){
      const px = Math.round(parseFloat(arg) * 10) / 10;
      if(!Number.isFinite(px) || px < 6 || px > 40){ range.insertNode(frag); return; }
      const wrap = document.createElement('span');
      wrap.style.fontSize = px + 'px';
      wrap.dataset.size = String(px);
      wrap.appendChild(frag);
      range.insertNode(wrap);
    } else {
      range.insertNode(frag);
    }
    surface.dispatchEvent(new Event('input', {bubbles:true}));
    return;
  }
  /* A rule under the words or through them.
   *
   * Toggling, not stacking: pressing it again on a run that already has
   * one takes it off. A citation is stepped around — it is a chip
   * pointing at a reference, and a line drawn across a number reads as a
   * number that has been struck out. `restyle` re-applies the kind of
   * line without toggling, which is what the style picker beside the
   * buttons does. */
  if(kind === 'under' || kind === 'strike'){
    const attr = kind === 'under' ? 'data-under' : 'data-strike';
    const line = kind === 'under' ? 'underline' : 'line-through';
    const other = kind === 'under' ? 'data-strike' : 'data-under';
    const otherLine = kind === 'under' ? 'line-through' : 'underline';
    const style = LINE_STYLES[arg] ? arg : 'solid';
    const sel = window.getSelection && window.getSelection();
    if(!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if(range.collapsed || !surface.contains(range.commonAncestorContainer)) return;
    const had = hadAll !== undefined ? hadAll : !restyle && !!lineStateOf(surface)[kind === 'under' ? 'under' : 'strike'];
    /* A selection across lines is ruled, or cleared, line by line, each
       line's part on its own: taken out whole it came back as lines of
       its own, so ruling from the middle of one line to the middle of
       the next split both in two (the owner's list of 15.11). Whether the
       rule goes on or off is decided once, for the whole selection. */
    const parts = linePartsOf(surface, range);
    if(parts){
      const done = [];
      for(let k = parts.length - 1; k >= 0; k--){
        sel.removeAllRanges(); sel.addRange(parts[k]);
        applyRichCommand(surface, kind, arg, restyle, had);
        if(sel.rangeCount) done.push(sel.getRangeAt(0).cloneRange());
      }
      if(done.length){
        const all = document.createRange();
        all.setStart(done[done.length - 1].startContainer, done[done.length - 1].startOffset);
        all.setEnd(done[0].endContainer, done[0].endOffset);
        sel.removeAllRanges(); sel.addRange(all);
      }
      return;
    }
    const frag = range.extractContents();
    // Strip whatever this kind of rule the selection already carries.
    const strip = (node)=>{
      Array.from(node.childNodes).forEach(child=>{
        if(child.nodeType !== 1) return;
        strip(child);
        if(!child.getAttribute || !child.getAttribute(attr)) return;
        child.removeAttribute(attr);
        const keeps = child.getAttribute(other);
        child.style.textDecorationLine = keeps ? otherLine : '';
        if(keeps) child.style.textDecorationStyle = (LINE_STYLES[keeps] || LINE_STYLES.solid).css;
        /* …and the rule's style with it: a span left holding nothing but
           a text-decoration-style was no longer bare, stayed, and kept
           whatever it had wrapped where it had been put. */
        else child.style.removeProperty('text-decoration-style');
        const bare = child.tagName === 'SPAN' && !keeps &&
          (!child.getAttribute('style') || !child.getAttribute('style').trim()) &&
          !child.getAttribute('data-font') && !child.getAttribute('data-size') &&
          !child.getAttribute('data-ref') && !child.getAttribute('data-sticker');
        if(bare){
          while(child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
        }
      });
    };
    strip(frag);
    if(had){
      /* The rule may be on a run AROUND the selection rather than inside
         it — a space ruled by itself, a word picked out of a ruled line —
         and then the fragment holds only text, and went back inside the
         run that rules it: pressing the button again did nothing (the
         owner's list of 7.11, on a space). The run is split round the
         selection instead, keeping its rule either side and not over it,
         as a colour's run is (takeColourOver). */
      const mark = document.createElement('span');
      mark.appendChild(frag);
      range.insertNode(mark);
      for(let a = mark.parentNode; a && a !== surface && surface.contains(a); ){
        const up = a.parentNode;
        if(a.nodeType === 1 && a.getAttribute(attr)){
          const side = (start)=>{
            const r = document.createRange();
            if(start){ r.setStart(a, 0); r.setEndBefore(mark); }
            else { r.setStartAfter(mark); r.setEnd(a, a.childNodes.length); }
            const part = r.extractContents();
            if(!part.textContent) return null;
            const twin = a.cloneNode(false);
            twin.appendChild(part);
            return twin;
          };
          const before = side(true), after = side(false);
          if(before) up.insertBefore(before, a);
          if(after) up.insertBefore(after, a.nextSibling);
          a.removeAttribute(attr);
          const keeps = a.getAttribute(other);
          a.style.textDecorationLine = keeps ? otherLine : '';
          if(keeps) a.style.textDecorationStyle = (LINE_STYLES[keeps] || LINE_STYLES.solid).css;
          else a.style.removeProperty('text-decoration-style');
          const bare = a.tagName === 'SPAN' && !keeps &&
            (!a.getAttribute('style') || !a.getAttribute('style').trim()) &&
            !a.getAttribute('data-font') && !a.getAttribute('data-size') &&
            !a.getAttribute('data-ref') && !a.getAttribute('data-sticker');
          if(bare){
            while(a.firstChild) up.insertBefore(a.firstChild, a);
            up.removeChild(a);
          }
        }
        a = up;
      }
      const first = mark.firstChild, last = mark.lastChild;
      while(mark.firstChild) mark.parentNode.insertBefore(mark.firstChild, mark);
      const host = mark.parentNode;
      host.removeChild(mark);
      if(first && last){
        const back = document.createRange();
        back.setStartBefore(first); back.setEndAfter(last);
        sel.removeAllRanges(); sel.addRange(back);
      }
    } else {
      /* One wrapper around the whole selection.
       *
       * A citation inside it is exempt without being stepped around: a
       * rule is a text decoration, and a decoration is not propagated into
       * an atomic inline-level box — which is what `.ref-chip` is made,
       * for exactly this reason. That holds at any depth, which a pass
       * over the fragment's top-level children did not: a citation sitting
       * inside a bold run within the selection was wrapped like ordinary
       * text and drawn through. The chart applies the same exemption from
       * the other side, since a citation is laid out as its own tspan and
       * never takes the run's styling. */
      const wrap = document.createElement('span');
      wrap.style.textDecorationLine = line;
      wrap.style.textDecorationStyle = (LINE_STYLES[style] || LINE_STYLES.solid).css;
      wrap.setAttribute(attr, style);
      range.insertNode(wrapInlineRuns(frag, wrap));
    }
    surface.dispatchEvent(new Event('input', {bubbles:true}));
    return;
  }
  if(kind === 'font' || kind === 'unfont'){
    const sel = window.getSelection && window.getSelection();
    if(!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    // Only words in this field: the selection may be anywhere on the page.
    if(range.collapsed || !surface.contains(range.commonAncestorContainer)) return;
    const frag = range.extractContents();
    // Strip any face already on the selection, then wrap it in the new one.
    const strip = (node)=>{
      Array.from(node.childNodes).forEach(child=>{
        if(child.nodeType !== 1) return;
        strip(child);
        const el = child;
        if(!fontKeyOfEl(el)) return;
        if(el.dataset) delete el.dataset.font;
        if(el.style) el.style.removeProperty('font-family');
        const bare = el.tagName === 'SPAN' &&
          (!el.getAttribute('style') || !el.getAttribute('style').trim()) &&
          !el.getAttribute('data-font');
        if(bare){
          while(el.firstChild) node.insertBefore(el.firstChild, el);
          node.removeChild(el);
        }
      });
    };
    strip(frag);
    if(kind === 'font'){
      const wrap = document.createElement('span');
      wrap.style.fontFamily = fontFamilyFor(arg);
      wrap.dataset.font = arg;
      wrap.appendChild(frag);
      range.insertNode(wrap);
    } else {
      range.insertNode(frag);
    }
    surface.dispatchEvent(new Event('input', {bubbles:true}));
    return;
  }
  /* Bold, italic and readings off. execCommand can turn bold and italic
     off only by toggling, which turns them ON where they were absent — so
     the tags are unwrapped by hand, exactly as the colour is. A reading
     collapses to the word it was over; the reading itself is an
     annotation, and there is nowhere for it to go. */
  if(kind === 'unstyle'){
    const sel = window.getSelection && window.getSelection();
    if(!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if(range.collapsed || !surface.contains(range.commonAncestorContainer)) return;
    const frag = range.extractContents();
    const strip = (node)=>{
      Array.from(node.childNodes).forEach(child=>{
        if(child.nodeType !== 1) return;
        strip(child);
        const t = child.tagName;
        if(t === 'RUBY'){
          /* A reading is CONTENT, not formatting: the annotation is
             something the author wrote, and clearing the formatting is not
             a licence to delete it. This used to collapse the whole thing
             to its base word, so pressing ⟲ silently threw the reading
             away. What comes off is the formatting inside it, which the
             recursion above has already done. */
          child.removeAttribute('style');
          return;
        }
        if(t === 'RT'){ child.removeAttribute('style'); return; }
        if(t === 'B' || t === 'STRONG' || t === 'I' || t === 'EM' || t === 'U'){
          while(child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        if(t === 'SPAN' && child.style){
          child.style.removeProperty('font-weight');
          child.style.removeProperty('font-style');
          child.style.removeProperty('text-decoration-line');
          child.style.removeProperty('text-decoration-style');
          child.style.removeProperty('text-decoration-color');
          child.removeAttribute('data-under');
          child.removeAttribute('data-strike');
          const bare = (!child.getAttribute('style') || !child.getAttribute('style').trim()) &&
            !child.getAttribute('data-font') && !child.getAttribute('data-size') &&
            !child.getAttribute('data-sticker') && !child.getAttribute('data-ref');
          if(bare){
            while(child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
          }
        }
      });
    };
    strip(frag);
    range.insertNode(frag);
    surface.dispatchEvent(new Event('input', {bubbles:true}));
    return;
  }
  if(kind === 'uncolor'){
    const sel = window.getSelection && window.getSelection();
    if(!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if(range.collapsed || !surface.contains(range.commonAncestorContainer)) return;
    // Re-emit the selected content with every colour carrier unwrapped.
    const frag = range.extractContents();
    const strip = (node)=>{
      Array.from(node.childNodes).forEach(child=>{
        if(child.nodeType !== 1) return;
        strip(child);
        const el = child;
        const carriesColor = (el.style && el.style.color) || el.tagName === 'FONT';
        if(!carriesColor) return;
        if(el.style) el.style.removeProperty('color');
        if(el.tagName === 'FONT') el.removeAttribute('color');
        /* A span that existed only to carry the colour is now noise — but
           a citation IS a span that carries a colour, its own, and
           unwrapping it left the number it happens to display standing in
           the text as three ordinary characters pointing at nothing. A
           sticker's placeholder is the same shape. Neither is a wrapper. */
        const atomic = el.getAttribute &&
          (el.getAttribute('data-ref') || el.getAttribute('data-sticker'));
        const bare = !atomic && (el.tagName === 'FONT' ||
          (el.tagName === 'SPAN' && (!el.getAttribute('style') || !el.getAttribute('style').trim())));
        if(bare){
          while(el.firstChild) node.insertBefore(el.firstChild, el);
          node.removeChild(el);
        }
      });
    };
    strip(frag);
    range.insertNode(frag);
    surface.dispatchEvent(new Event('input', {bubbles:true}));
    return;
  }
  if(kind === 'color'){
    const hex = arg;
    if(!HEX_RE.test(hex || '')) return;
    const sel = window.getSelection();
    if(!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if(!surface.contains(range.commonAncestorContainer)) return;
    // Wrapped by hand rather than via execCommand('foreColor'), which
    // emits <font> on some engines and CSS spans on others; one span with
    // an inline color maps cleanly onto the {{#hex|…}} markup either way.
    const span = document.createElement('span');
    span.style.color = hex;
    try{
      range.surroundContents(span);
    }catch(e){
      // surroundContents refuses a selection that only partly covers an
      // element; extracting and re-inserting handles that case.
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    takeColourOver(span, surface);
    const pick = document.createRange();
    pick.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(pick);
    /* The surface has to be TOLD it changed. Bold and italic go through
       execCommand, which fires `input` itself; a span wrapped by hand does
       not, and every commit on this page hangs off that event. So the
       colour appeared in the box, was never written to the entry, never
       reached the chart, and was gone the next time the form was opened —
       from the outside, a colour button that did nothing. */
    surface.dispatchEvent(new Event('input', {bubbles:true}));
    return;
  }
  if(kind === 'ruby'){
    const sel = window.getSelection();
    if(!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if(!surface.contains(range.commonAncestorContainer)) return;

    // Ruby cannot nest: the stored markup has no grammar for a reading
    // inside a reading ([[a|[[b|c]]]] is not parseable), and the browser
    // would happily build one. Two ways to end up nested, both refused:
    // the caret already sitting inside a ruby, or a selection that spans
    // one. When the caret is already in a ruby the useful thing to do is
    // put it on that ruby's own annotation, which is almost certainly
    // what was meant.
    let anchor = range.commonAncestorContainer;
    if(anchor.nodeType === 3) anchor = anchor.parentNode;
    const enclosing = anchor && anchor.closest ? anchor.closest('ruby') : null;
    if(enclosing){
      const rt = enclosing.querySelector('rt');
      if(rt){
        const pick = document.createRange();
        pick.selectNodeContents(rt);
        sel.removeAllRanges();
        sel.addRange(pick);
      }
      return;
    }
    const contents = range.cloneContents();
    if(contents.querySelector && contents.querySelector('ruby')) return;

    /* A reading is text ABOVE text, and a sticker or a citation is not
       text: `range.toString()` returns nothing for them, so putting a
       reading over a selection containing one silently deleted it. Rather
       than destroy them, the command declines — turning a reading off for
       exactly the things it cannot be applied to. */
    const holder = document.createElement('div');
    holder.appendChild(range.cloneContents());
    if(holder.querySelector('[data-sticker], [data-ref]')) return;
    /* The word keeps everything it was wearing.
     *
       This used to take `range.toString()` — the selection's bare
       characters — and put THAT under the reading, so putting a reading
       over a word that was bold, coloured, underlined or struck through
       silently returned it to plain text; over a whole label, the whole
       label. And it stripped every `]` and `|` out of the base as it went,
       on the grounds that those two characters separate a reading's halves
       in the stored form — which was true before both halves learned to
       escape them, and has since meant that `asdasd[1]` came back as
       `asdasd[1`, a character short.
     *
       The selected content is moved into the reading exactly as it stands.
       A selection spanning a line break is the one thing that cannot be:
       a reading is one unit on one line, and a fragment carrying a block
       would build a `<ruby>` around a `<div>`. That falls back to the
       words alone. */
    const frag = range.extractContents();
    const ruby = document.createElement('ruby');
    const probe = document.createElement('div');
    probe.appendChild(frag.cloneNode(true));
    if(probe.querySelector('div, p, br')){
      ruby.appendChild(document.createTextNode(probe.textContent || 'word'));
    } else {
      ruby.appendChild(frag);
      if(!ruby.textContent) ruby.appendChild(document.createTextNode('word'));
    }
    /* Empty, waiting for its words: it used to say "reading", which had
       to be typed over and, left, was a reading of "reading" (the owner's
       list of 25.11). Held open while the caret is in it (fresh), and
       gone as soon as it is left empty. */
    const rt = document.createElement('rt');
    rt.textContent = '\u200b';
    rt.dataset.fresh = '1';
    ruby.appendChild(rt);
    range.insertNode(ruby);
    // Leave the annotation selected so it can be typed over immediately.
    const pick = document.createRange();
    pick.selectNodeContents(rt);
    sel.removeAllRanges();
    sel.addRange(pick);
    // Same as the colour: inserted by hand, so the commit has to be told.
    surface.dispatchEvent(new Event('input', {bubbles:true}));
  }
}
function rememberSurfaceSelection(box){
  const surface = surfaceForHexBox(box);
  if(!surface) return;
  let held = null;
  const sel = window.getSelection && window.getSelection();
  if(sel && sel.rangeCount){
    const r = sel.getRangeAt(0);
    if(!r.collapsed && surface.contains(r.commonAncestorContainer)) held = r.cloneRange();
  }
  if(!held && lastSurfaceRange && lastSurfaceRange.surface === surface){
    held = lastSurfaceRange.range;
  }
  if(!held) return;
  heldSelection.set(box, held);
  paintHeldSelection(held);
}
function restoreSurfaceSelection(box){
  const surface = surfaceForHexBox(box);
  if(!surface) return surface;
  /* A LIVE selection in the surface always wins over the remembered one.
     The remembered range is there for the case where focus went into the
     hex box to type a value; once the reader has gone back and picked
     different words, it is stale — and restoring it put the colour on the
     first run again and dragged the visible selection back there with it,
     which is exactly what a second colour on a second phrase looked like. */
  const sel = window.getSelection && window.getSelection();
  if(sel && sel.rangeCount){
    const live = sel.getRangeAt(0);
    if(!live.collapsed && surface.contains(live.commonAncestorContainer)){
      heldSelection.delete(box);
      paintHeldSelection(null);
      return surface;
    }
  }
  const held = heldSelection.get(box);
  if(!held){ paintHeldSelection(null); return surface; }
  paintHeldSelection(null);
  surface.focus({preventScroll:true});
  const s2 = window.getSelection();
  s2.removeAllRanges();
  s2.addRange(held);
  return surface;
}
function applyHexFromBox(box, hex){
  const surface = restoreSurfaceSelection(box) || surfaceForHexBox(box);
  if(!surface) return;
  applyRichCommand(surface, 'color', hex);
}
function commitDetailNote(){
  const id = detailNoteOwner;
  if(!id || readOnlyView) return;
  const n = nodes.get(id);
  if(!n) return;
  const text = detailNoteInput.value.trim();
  if((n.note || '') === text) return;
  if(!detailNoteUndoPushed){ pushUndo(); detailNoteUndoPushed = true; }
  commitEntry(()=>{
    const found = workingEntry(id);
    if(!found) return;
    found.entry[4] = text || undefined;
    putEntry(found.index, found.entry, entryOpts(found.entry));
  });
}
function queueDetailNoteCommit(){
  if(detailNoteTimer) clearTimeout(detailNoteTimer);
  detailNoteTimer = setTimeout(()=>{ detailNoteTimer = 0; commitDetailNote(); }, 480);
}
