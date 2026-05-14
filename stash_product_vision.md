## V0 Stash Product Vision

This is our opinionated vision of how work is gonna get done in the future. So in a Stash Workspace, there are basically three things:

1. Sessions  
   1. This is a dump of all of your agent’s chat transcripts and their outputs. This also includes any file that was created by the agent as part of its thinking (like a [PLAN.md](http://PLAN.md))  
   2. Sessions are tagged by which human kicked off the run, and what coding agent it was (eg Henry’s Codex on GPT-5.5 ultra high thinking)  
2. Wiki  
   1. This is just a notion clone. Except AI can navigate it way better because it’s exposed as a virtual filesystem, and because it allows html. Basically, we have a nice, well-designed CLI that allows any agent to navigate the wiki as if it were a filesystem. But under the hood, we could make it a db for performance reasons.  
   2. Humans can create a page.  
3. Stashes  
   1. This is a ***new thing***. It didn’t exist before 2026, but we’re betting that it’s going to be a totally fundamental unit of getting work done as agents produce more and more information. It is a combination of sessions and wiki pages.   
   2. Stashes can be published. Publishing them makes them look pretty, and also a page that’s used in a published stash is harder to edit because it’s for external consumption (maybe we ask you “are you sure?”). When you publish, you are asked whether you want to share to the “discover”page.  
   3. Your workspace can have Stashes created from files within your workspace, as well as *external stashes* from outside your workspace. These are meant to function as *matrix kung fu-style cartridges* of information. Where do you get external stashes? Well, if you view a stash that’s not yours, then there will be a button that says “add to my workspace” and if you click it, then that stash will be added to your workspace  
   4. It will be optional but not required that a stash has a HANDOFF.html, which is a file explaining what the stash is about that acts as a bit of an index for the stash. It’s just a normal .html page.

Product Requirements:

1. Users can easily see what Pages and Sessions are in a Stash, and you can also easily see which Stashes a given Page and Session is in.  
2. There is beautiful UI to view a Page and a Session in the webapp  
3. There is a beautiful sidebar UI to view the filetree of Pages, and the flat list of Sessions  
4. There is the ability to search Pages, Sessions, and Stashes. You can limit a search to a certain Page or Folder, or a certain Stash, or “internal only” (no external stashes).   
5. In the product, you can easily create a stash by manually selecting which pages and sessions will go into it. Furthermore, you can easily ask your agent to create a stash, and it will be able to find the right pages and sessions to include in it.  
6. Collaboration  
   1. A Stash Workspace can have members in it. An admin can invite you to a workspace. You’re an admin if you made the workspace, or if another admin set you as an admin.  
   2. When you’re in Stash, which workspace you’re in is clearly visible in the top left of the screen.   
   3. Within a stash, you can create a public page, or you can create a private page to certain members of the workspace. This is mediated by a page privacy tag.  
   4. Sessions are default uploaded to the workspace visible to everyone in the workspace, but you can also change their privacy to be yourself only, or a certain group only. This is mediated by a session privacy tag.  
   5. If you publish a stash, you get a public-facing link to it. And that stash is publicly-viewable.  
7. We have A beautiful and elegant CLI \+ MCP that allows AI to take almost any action on a Stash Workspace that a human can take, including CRUD on Pages, Sessions, and Stashes. The only thing an AI cannot do via CLI/MCP is edit the list of workspace members.

Notes:

1. We expect a common usage pattern around publish to be: “write a new page specifically for the purposes of publishing it in an external stash”

Open Questions:

1. What’s on the user’s homepage? A newsfeed? Alternatively, we could copy notion and make it the wiki homepage.  
   1. A: Newsfeed  
2. Is newsfeed/discover in scope for v0?  
   1. A: Yes  
3. Can you only be in one workspace at a time?  
   1. Yes  
4. Do we have “requests to join” in v0?  
   1. No not needed  
5. Should a “table” be a separate type of page? Or can a page have a table in it?  
   1. Yes its a separate type of page analogous to .csv.  
   2. No a table cannot have a page in it because that’s annoying to agents  
6. Can pages have subpages? Do we have folders?  
   1. (1) no (2) yes  
7. What happens if I am shared a Stash that has some pages in it that are visible to me, and some that aren’t?  
   1. My suggestion: a Stash takes on the privacy level as the intersection of its privacy rules. So you have to be shared on literally everything in the stash to be able to view it.

Glossary:

1. A **Stash Workspace** is the top level unit of this product. Everything lives in it. Closest comp is a Slack Workspace  
2. A **Session** is a transcript of a coding agent session, along with any artifacts it generated along the way (eg [PLAN.md](http://PLAN.md))  
   1. An **Artifact** is the term for a file that is attached to a Session because it was generated during that session.   
3. A **Page** is any node in the **Wiki**. We support these types of pages: html, markdown, any kind of file, any kind of image, and many notion-style blocks like tables).   
4. A **Folder** is where Pages can live in the wiki.  
5. A **Stash** is our primary novel invention. It’s a combination of Sessions and Pages. We think it will be the best way to share information with collaborators in the next few years, as more and more of the valuable information created by agents lives in Session transcripts.   
   1. A stash can be **published**. This is mostly aesthetic, it just means that we (1) make it public (2) give the user a Sharable link, and warn the user before editing anything in the published stash. But you can totally do all these things without ever hitting the publish button. it’s literally syntactic sugar for “make this stash public and give me the sharing link for it and make it look prettier”  
   2. An **External Stash** is just any Stash that was added to a Workspace by the “Add to Workspace” button rather than by natively making it inside the workspace.  
6. **Tags** are a label that you can attach to one or many **Sessions** or **Pages**. They’re used to set privacy rules. Tags are absolutely the only mechanism for privacy decisions. There is no other source of truth for privacy.  
   

FAQ

1. Q: How do we handle privacy?   
   1. A *session* can be tagged as “only visible to certain people” (and you can set your stash uploader hook to apply this tag to all of your sessions)  
   2. A *wiki file or folder* can also be tagged like this.  
   3. By publishing   
2. Q: Can wiki pages be published?  
   1. No, only stashes.   
3. Q: Is there a concept of tagging?  
   1. Yep\! You can use them however you like. And tags can carry sharing information (eg a tag can say “private except to A,B, and C”)  
4. Q: Are there workspaces?  
   1. Yes\! A stash workspace is a combination of Sessions, Wiki, and Stashes  
5. Q: Is there a concept of “views”?  
   1. Yes, but we’re calling them “Stashes” now  
6. Q: When you edit a stash, does the underlying page get edited?  
   1. You can’t edit a stash, actually. That sentence has no meaning. It’s like saying “can I edit a folder in google drive”   
   2. But yeah, if you edit a page included in a stash, then the stash will reflect that change. If the stash is published, then you can’t edit the underlying page without seeing a little warning “are you sure? It’s published\!”  
7. Q: Can a user be a member of more than one Stash Workspace?  
   1. Yeah, it’s like Slack  
8. Q: Do we expect that a given bit of information will typically live in more than one stash?  
   1. It totally could\! And that’s fine. The same underlying page could be used in a bunch of stashes  
9. Q: Does every stash need to live in a workspace?  
   1. Yes\! It does. But you can share a stash to other workspaces.  
10. Q: Is a github repo meant to be uploading to only one stash workspace?  
    1. Yes. We won’t prevent you from streaming transcripts to several workspaces, but that’s weird.  
11. Q: Is a stash workspace meant to have only one github repo?  
    1. No, you can have several. Eg: /frontend, /backend  
12. Q: Is a Stash Live or a Snapshot?  
    1. Live\! However, we make published pages kinda “snapshot-y” but warning you against editing a page contained in a “published” stash  
13. Q: Wait, so when you add an external Stash to your workspace, is that a live thing that the author can edit at any time?  
    1. Yep\!  
14. Q: Does a stash have version history? Does a wiki have version history?  
    1. Nope\! Not in v0 at least.  
15. Q: How do things get added to a stash workspace?  
    1. Three ways:  
       1. From the transcript upload hook  
       2. From an agent manually doing it via CLI or MCP  
       3. From a human manually doing it via UI  
16. Q: What are we going to integrate with? Slack? Granola? Drive?  
    1. Literally nothing. For v0 that is. Obviously this should be a fast follow but let’s just get the core thing up and running first.  
17. Q: If the agent creates a page, who is the owner of that page?  
    1. Who said pages had owners?  
18. Q: Do sessions include files that were \*edited\* as part of the coding agent run, or just ones that it creates? What about .tsx files? Like real, new codebase files.  
    1. Sessions should only include as artifacts files that are not part of the codebase, to avoid duplication with git.

## Not in Scope for V0

- Uploading anything besides coding agent session transcripts and their associated artifacts to the session view. We acknowledge that in future versions, we might want to support uploading slack convos, granola transcripts, etc.  
- Agents editing the wiki via sleep-time compute, in any way. No curator agent whatsoever.  
- “Favoriting” a Stash  
- Version history for a stash  
- Version history for a wiki  
- Any integrations of any kind

Appendix

Here are some product principles we will never betray:

1. All transcripts can just go into a magic black hole, you don’t need to route them yourself.  
2. You can easily find information that you’re looking for by searching for it with a search bar  
3. Agents can write pages  
4. It's easy to share information with people

