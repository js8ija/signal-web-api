
const e=require(`../chunks/chunk-DzJ5_V0X.js`),t=require(`../chunks/emoji.std-Cuq2AtcX.js`),n=require(`../chunks/log.std-BDabJhnf.js`),r=require(`../chunks/errors.std-7sZchtic.js`),i=require(`../chunks/Reactions.std-CVvukf6H.js`);let a=require(`node:path`),o=require(`node:crypto`),s=require(`node:fs`),c=require(`node:assert`);c=e.o(c);let l=require(`node:util`),u=require(`node:worker_threads`),d=require(`node:v8`),f=require(`@signalapp/ringrtc`),p=require(`@signalapp/sqlcipher`);p=e.o(p);var m=e.o(t.Wi());t.bi(),n.n(),i.Br(),i.Rr(),i.Or(),i.Qn(),i.qn(),i.Gn(),i.Q(),i.n();const h=`always-relay-calls.audio-notification.audioMessage.auto-download-update.autoConvertEmoji.badge-count-muted-conversations.call-ringtone-notification.call-system-notification.customColors.defaultConversationColor.existingOnboardingStoryMessageIds.hasCompletedSafetyNumberOnboarding.hasCompletedUsernameLinkOnboarding.hide-menu-bar.incoming-call-notification.navTabsCollapsed.notification-draw-attention.notification-setting.pinnedConversationIds.preferred-audio-input-device.preferred-audio-output-device.preferred-video-input-device.preferredLeftPaneWidth.preferredReactionEmoji.sent-media-quality.showStickerPickerHint.showStickersIntroduction.emojiSkinToneDefault.textFormatting.zoomFactor.attachmentMigration_lastProcessedIndex.attachmentMigration_isComplete.blockedMessageMigrationVersion.chromiumRegistrationDoneEver.version.number_id.uuid_id.pni.accountEntropyPool.backupKeyViewedHash.backupMediaRootKey.lastLocalBackup.localBackupFolder.profileKey.avatarUrl.usernameLinkColor.androidSpecificSettings.subscriberId.subscriberCurrencyCode.auto-download-attachment-primary.phoneNumberSharingMode.phoneNumberDiscoverability.preferContactAvatars.universalExpireTimer.displayBadgesOnProfile.keepMutedChatsArchived.hasSetMyStoriesPrivacy.hasViewedOnboardingStory.hasKeyTransparencyDisabled.hasStoriesDisabled.preferredReactionEmoji.androidSpecificSettings.sealedSenderIndicators.storyViewReceiptsEnabled.hasCompletedUsernameOnboarding.hasSeenGroupStoryEducationSheet.hasSeenAdminDeleteEducationDialog.callsUseLessDataSetting.optimizeOnDeviceStorage.allowSealedSenderFromAnyone.pinReminders.screenLockTimeoutMinutes.sent-media-quality.defaultWallpaperPreset.defaultWallpaperPhotoPointer.defaultDimWallpaperInDarkMode.defaultAutoBubbleColor.restoredBackupFirstAppVersion`.split(`.`),g=[`auto-download-attachment`,`blocked-groups`,`blocked-uuids`,`read-receipt-setting`,`blocked`,`device_name`,`seenPinMessageDisappearingMessagesWarningCount`,`usernameLastIntegrityCheck`,`usernameCorrupted`,`usernameLinkCorrupted`,`usernameLink`,`notificationProfileOverride`,`notificationProfileOverrideFromPrimary`,`notificationProfileSyncDisabled`,`sendEditWarningShown`,`formattingWarningShown`,`localDeleteWarningShown`];t.hi(),n.f(),t.qr(),i.i();const _={fatal(...e){console.error(...e)},error(...e){console.error(...e)},warn(...e){console.warn(...e)},info(...e){console.info(...e)},debug(...e){console.debug(...e)},trace(...e){console.log(...e)},child(){return _}};t.ai(),t.g(),t.m(),t.d(),i.Yn(),t.ct(),i.xr();function v(e){let t=e.prepare(`SELECT json FROM items WHERE id = $id;`).get({id:`uuid_id`});if(!t)return;let{value:n}=JSON.parse(t.json),[r]=i.Sr(String(n).toLowerCase());return r}function y(e,n){let r=e.prepare(`
    SELECT uuid
    FROM
      conversations
    WHERE
      id = $conversationId
    `,{pluck:!0}),a=e.prepare(`
      SELECT uuid, e164, active_at
      FROM
        conversations
      WHERE
        id = $conversationId
    `),o=(e,t)=>{let n=a.get({conversationId:e}),r=a.get({conversationId:t}),i=!!(n?.uuid&&n?.e164),o=!!(r?.uuid&&r?.e164);return!i&&!o?0:i?o?(n?.active_at??0)-(r?.active_at??0):1:-1},s=()=>{let n=[e.prepare(`DELETE FROM senderKeys`).run().changes,e.prepare(`DELETE FROM sessions`).run().changes,e.prepare(`DELETE FROM signedPreKeys`).run().changes,e.prepare(`DELETE FROM preKeys`).run().changes].reduce((e,t)=>e+t);return t.ft(e,`items`,`identityKey`),t.ft(e,`items`,`registrationId`),n},c=n=>{let r=t.nt(e,`items`,`identityKey`),i=t.nt(e,`items`,`registrationId`);r&&t.et(e,`items`,{id:`identityKeyMap`,value:{[n]:r.value}}),i&&t.et(e,`items`,{id:`registrationIdMap`,value:{[n]:i.value}}),e.exec(`
      DELETE FROM items WHERE id = 'identityKey' OR id = 'registrationId';
      `)},l=t=>{for(let n of[`signedPreKeys`,`preKeys`])e.prepare(`
        UPDATE ${n}
        SET
          id = $ourUuid || ':' || id,
          json = json_set(
            json,
            '$.id',
            $ourUuid || ':' || json_extract(json, '$.id'),
            '$.keyId',
            json_extract(json, '$.id'),
            '$.ourUuid',
            $ourUuid
          )
        `).run({ourUuid:t})},u=t=>{let a=e.prepare(`SELECT id, senderId, lastUpdatedDate FROM senderKeys`).all();n.info(`Updating ${a.length} sender keys`);let s=e.prepare(`
      UPDATE senderKeys
      SET
        id = $newId,
        senderId = $newSenderId
      WHERE
        id = $id
      `),c=e.prepare(`DELETE FROM senderKeys WHERE id = $id`),l=new Map,u=0,d=0,f=0;for(let{id:e,senderId:n,lastUpdatedDate:p}of a){let[a]=i.Sr(n),m=r.get({conversationId:a});if(!m){d+=1,c.run({id:e});continue}let h=`${t}:${e.replace(a,m)}`,g=l.get(h);if(g?f+=1:u+=1,g&&(p<g.lastUpdatedDate||o(a,g.conversationId)<0)){c.run({id:e});continue}else g&&c.run({id:h});l.set(h,{conversationId:a,lastUpdatedDate:p}),s.run({id:e,newId:h,newSenderId:n.replace(a,m)})}n.info(`Updated ${a.length} sender keys: updated: ${u}, deleted: ${d}, skipped: ${f}`)},d=t=>{let i=e.prepare(`SELECT id, conversationId FROM SESSIONS`).all();n.info(`Updating ${i.length} sessions`);let a=e.prepare(`
      UPDATE sessions
      SET
        id = $newId,
        ourUuid = $ourUuid,
        uuid = $uuid,
        json = json_set(
          sessions.json,
          '$.id',
          $newId,
          '$.uuid',
          $uuid,
          '$.ourUuid',
          $ourUuid
        )
      WHERE
        id = $id
      `),s=e.prepare(`DELETE FROM sessions WHERE id = $id`),c=new Map,l=0,u=0,d=0;for(let{id:e,conversationId:n}of i){let i=r.get({conversationId:n});if(!i){u+=1,s.run({id:e});continue}let f=`${t}:${e.replace(n,i)}`,p=c.get(f);if(p?d+=1:l+=1,p&&o(n,p.conversationId)<0){s.run({id:e});continue}else p&&s.run({id:f});c.set(f,{conversationId:n}),a.run({id:e,newId:f,uuid:i,ourUuid:t})}n.info(`Updated ${i.length} sessions: updated: ${l}, deleted: ${u}, skipped: ${d}`)},f=()=>{let t=e.prepare(`SELECT id FROM identityKeys`).all();n.info(`Updating ${t.length} identity keys`);let i=e.prepare(`
      UPDATE OR REPLACE identityKeys
      SET
        id = $newId,
        json = json_set(
          identityKeys.json,
          '$.id',
          $newId
        )
      WHERE
        id = $id
      `),a=0;for(let{id:e}of t){let t=r.get({conversationId:e}),n;t?(a+=1,n=t):n=`conversation:${e}`,i.run({id:e,newId:n})}n.info(`Migrated ${a} identity keys`)};e.exec(`
    -- Change type of 'id' column from INTEGER to STRING

    ALTER TABLE preKeys
    RENAME TO old_preKeys;

    ALTER TABLE signedPreKeys
    RENAME TO old_signedPreKeys;

    CREATE TABLE preKeys(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );
    CREATE TABLE signedPreKeys(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );

    -- sqlite handles the type conversion
    INSERT INTO preKeys SELECT * FROM old_preKeys;
    INSERT INTO signedPreKeys SELECT * FROM old_signedPreKeys;

    DROP TABLE old_preKeys;
    DROP TABLE old_signedPreKeys;

    -- Alter sessions

    ALTER TABLE sessions
      ADD COLUMN ourUuid STRING;

    ALTER TABLE sessions
      ADD COLUMN uuid STRING;
    `);let p=v(e);if(!i.Vr(p)){let e=s();e>0&&n.error(`no uuid is available, erased ${e} sessions/keys`);return}l(p),u(p),d(p),c(p),f()}t.ct();function b(e,n){e.exec(`
    DROP TRIGGER messages_on_delete;

    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      DELETE FROM sendLogPayloads WHERE id IN (
        SELECT payloadId FROM sendLogMessageIds
        WHERE messageId = old.id
      );
      DELETE FROM reactions WHERE rowid IN (
        SELECT rowid FROM reactions
        WHERE messageId = old.id
      );
    END;
  `);let r=e.prepare(`SELECT id FROM messages ORDER BY id ASC;`,{pluck:!0}).all(),i=e.prepare(`SELECT rowid, messageId FROM reactions;`).all(),a=new Set(r),o=[];i.forEach(e=>{a.has(e.messageId)||o.push(e.rowid)});function s(t,n){e.prepare(`
      DELETE FROM reactions
      WHERE rowid IN ( ${t.map(()=>`?`).join(`, `)} );
      `,{persistent:n}).run(t)}o.length>0&&(n.info(`Deleting ${o.length} orphaned reactions`),t.X(e,o,s))}i.Hn(),t.ct();const{omit:x}=m.default;function S(e,n){let r=e.prepare(`
  SELECT uuid
  FROM
    conversations
  WHERE
    id = $conversationId
  `,{pluck:!0}),a=e.prepare(`
    UPDATE conversations SET
      json = $json,
      members = $members
    WHERE id = $id;
    `),o=e.prepare(`
    UPDATE messages SET
      json = $json,
      sourceUuid = $sourceUuid
    WHERE id = $id;
    `),s=e=>{let i=e,o=e,s=`(${i.id}) groupv2(${i.groupId})`;for(let e of[`membersV2`,`pendingMembersV2`,`pendingAdminApprovalV2`]){let a=i[e];if(!Array.isArray(a))continue;let c=0,l=a.map(t=>{let i=r.get({conversationId:t.conversationId});if(!i){n.warn(`${s}.${e} UUID not found for ${t.conversationId}`);return}let a={...x(t,`conversationId`),uuid:i};if(!(`addedByUserId`in t)||!t.addedByUserId)return a;let o=r.get({conversationId:t.addedByUserId});return o?(c+=1,{...a,addedByUserId:o}):a}).filter(t.oi);o={...o,[e]:l},a.length!==0&&n.info(`migrated ${a.length} ${e} entries to ${l.length} for ${s}`),c>0&&n.info(`migrated ${c} addedByUserId in ${e} for ${s}`)}if(o===e)return;let c;c=o.membersV2?o.membersV2.map(e=>e.uuid).join(` `):o.members?o.members.join(` `):null,a.run({id:o.id,json:t.ut(o),members:c})},c=e=>{let{id:a,groupV2Change:s,sourceUuid:c,invitedGV2Members:l}=e,u=e;if(s){t.Kr(u.groupV2Change,`Pacify typescript`);let e=r.get({conversationId:s.from});u=e?{...u,groupV2Change:{...u.groupV2Change,from:e}}:{...u,groupV2Change:x(u.groupV2Change,[`from`])};let i=!1,o=s.details.map((e,o)=>{let s=u.groupV2Change?.details[o];t.Kr(s,`Pacify typescript`);let c=s;for(let o of[`conversationId`,`inviter`]){let s=e[o],l=o===`conversationId`?`uuid`:o;if(s===void 0)continue;i=!0;let u=r.get({conversationId:s});if(!(o===`inviter`&&!u)){if(!u){n.warn(`${a}.groupV2Change.details.${o} UUID not found for ${s}`);return}t.Kr(c.type===e.type,`Pacify typescript`),c={...x(c,o),[l]:u}}}return c}).filter(t.oi);i&&(u={...u,groupV2Change:{...u.groupV2Change,details:o}})}if(c){let e=r.get({conversationId:c});e&&(u={...u,sourceUuid:e})}if(l){let e=l.map(({addedByUserId:e,conversationId:o},s)=>{let c=r.get({conversationId:o}),l=u.invitedGV2Members&&u.invitedGV2Members[s];if(t.Kr(l!==void 0,`Pacify typescript`),!c){n.warn(`${a}.invitedGV2Members UUID not found for ${o}`);return}let d={...x(l,[`conversationId`]),uuid:c};if(!e)return d;let f=r.get({conversationId:e});return f?{...d,addedByUserId:i.Un(f,`migration-43`)}:d}).filter(t.oi);u={...u,invitedGV2Members:e}}return u===e?!1:(o.run({id:u.id,json:JSON.stringify(u),sourceUuid:u.sourceUuid??null}),!0)},l=e.prepare(`
    SELECT json
    FROM conversations
    ORDER BY id ASC;
    `,{pluck:!0}).all().map(e=>t.lt(e));n.info(`About to iterate through ${l.length} conversations`);for(let e of l)s(e);let u=t.rt(e,`messages`);n.info(`About to iterate through ${u} messages`);let d=0;for(let n of new t.Y(e,`messages`))c(n)&&(d+=1);n.info(`Updated ${d} messages`)}function ee(e){e.exec(`
    CREATE TABLE badges(
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      descriptionTemplate TEXT NOT NULL
    );

    CREATE TABLE badgeImageFiles(
      badgeId TEXT REFERENCES badges(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      'order' INTEGER NOT NULL,
      url TEXT NOT NULL,
      localPath TEXT,
      theme TEXT NOT NULL
    );
    `)}function te(e){e.exec(`
    --- Add column to messages table

    ALTER TABLE messages ADD COLUMN storyId STRING;

    --- Update important message indices

    DROP INDEX   messages_conversation;
    CREATE INDEX messages_conversation ON messages
      (conversationId, type, storyId, received_at);

    DROP INDEX   messages_unread;
    CREATE INDEX messages_unread ON messages
      (conversationId, readStatus, type, storyId) WHERE readStatus IS NOT NULL;

    --- Update attachment indices for All Media views

    DROP INDEX   messages_hasAttachments;
    CREATE INDEX messages_hasAttachments
      ON messages (conversationId, hasAttachments, received_at)
      WHERE type IS NOT 'story' AND storyId IS NULL;

    DROP INDEX   messages_hasFileAttachments;
    CREATE INDEX messages_hasFileAttachments
      ON messages (conversationId, hasFileAttachments, received_at)
      WHERE type IS NOT 'story' AND storyId IS NULL;

    DROP INDEX   messages_hasVisualMediaAttachments;
    CREATE INDEX messages_hasVisualMediaAttachments
      ON messages (conversationId, hasVisualMediaAttachments, received_at)
      WHERE type IS NOT 'story' AND storyId IS NULL;

    --- Message insert/update triggers to exclude stories and story replies

    DROP   TRIGGER messages_on_insert;
    -- Note: any changes to this trigger must be reflected in 
    -- Server.ts: enableMessageInsertTriggersAndBackfill
    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce IS NOT 1 AND new.storyId IS NULL
    BEGIN
      INSERT INTO messages_fts
        (rowid, body)
      VALUES
        (new.rowid, new.body);
    END;

    DROP   TRIGGER messages_on_update;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN
      (new.body IS NULL OR old.body IS NOT new.body) AND
       new.isViewOnce IS NOT 1 AND new.storyId IS NULL
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
        (rowid, body)
      VALUES
        (new.rowid, new.body);
    END;

    --- Update delete trigger to remove storyReads

    --- Note: for future updates to this trigger, be sure to update Server.ts/removeAll()
    ---       (it deletes and re-adds this trigger for performance)
    DROP   TRIGGER messages_on_delete;
    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      DELETE FROM sendLogPayloads WHERE id IN (
        SELECT payloadId FROM sendLogMessageIds
        WHERE messageId = old.id
      );
      DELETE FROM reactions WHERE rowid IN (
        SELECT rowid FROM reactions
        WHERE messageId = old.id
      );
      DELETE FROM storyReads WHERE storyId = old.storyId;
    END;

    --- Story Read History

    CREATE TABLE storyReads (
      authorId STRING NOT NULL,
      conversationId STRING NOT NULL,
      storyId STRING NOT NULL,
      storyReadDate NUMBER NOT NULL,

      PRIMARY KEY (authorId, storyId)
    );

    CREATE INDEX storyReads_data ON storyReads (
      storyReadDate, authorId, conversationId
    );

    --- Story Distribution Lists

    CREATE TABLE storyDistributions(
      id STRING PRIMARY KEY NOT NULL,
      name TEXT,

      avatarUrlPath TEXT,
      avatarKey BLOB,
      senderKeyInfoJson STRING
    );

    CREATE TABLE storyDistributionMembers(
      listId STRING NOT NULL REFERENCES storyDistributions(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      uuid STRING NOT NULL,

      PRIMARY KEY (listId, uuid)
    )
    `)}function C(e){e.exec(`
    --- Add column to messages table

    ALTER TABLE messages
    ADD COLUMN
    isStory INTEGER
    GENERATED ALWAYS
    AS (type = 'story');

    --- Update important message indices

    DROP INDEX   messages_conversation;
    CREATE INDEX messages_conversation ON messages
      (conversationId, isStory, storyId, received_at, sent_at);
    `)}function w(e,t){e.exec(`
    DROP INDEX   messages_conversation;

    ALTER TABLE messages
      DROP COLUMN isStory;
    ALTER TABLE messages
      ADD COLUMN isStory INTEGER
      GENERATED ALWAYS AS (type IS 'story');

    ALTER TABLE messages
      ADD COLUMN isChangeCreatedByUs INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE messages
      ADD COLUMN shouldAffectActivity INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'group-v1-migration',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change',

          'keychange'
        )
      );

    ALTER TABLE messages
      ADD COLUMN shouldAffectPreview INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'group-v1-migration',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    ALTER TABLE messages
      ADD COLUMN isUserInitiatedMessage INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'group-v1-migration',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change',

          'group-v2-change',
          'keychange'
        )
      );

    ALTER TABLE messages
      ADD COLUMN isTimerChangeFromSync INTEGER
      GENERATED ALWAYS AS (
        json_extract(json, '$.expirationTimerUpdate.fromSync') IS 1
      );

    ALTER TABLE messages
      ADD COLUMN isGroupLeaveEvent INTEGER
      GENERATED ALWAYS AS (
        type IS 'group-v2-change' AND
        json_array_length(json_extract(json, '$.groupV2Change.details')) IS 1 AND
        json_extract(json, '$.groupV2Change.details[0].type') IS 'member-remove' AND
        json_extract(json, '$.groupV2Change.from') IS NOT NULL AND
        json_extract(json, '$.groupV2Change.from') IS json_extract(json, '$.groupV2Change.details[0].uuid')
      );

    ALTER TABLE messages
      ADD COLUMN isGroupLeaveEventFromOther INTEGER
      GENERATED ALWAYS AS (
        isGroupLeaveEvent IS 1
        AND
        isChangeCreatedByUs IS 0
      );

    CREATE INDEX messages_conversation ON messages
      (conversationId, isStory, storyId, received_at, sent_at);

    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, expiresAt, received_at, sent_at);

    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync, isGroupLeaveEventFromOther, received_at, sent_at);

    CREATE INDEX message_user_initiated ON messages (isUserInitiatedMessage);
    `);let n=v(e);n?e.prepare(`
      UPDATE messages SET
        isChangeCreatedByUs = json_extract(json, '$.groupV2Change.from') IS $ourUuid;
      `).run({ourUuid:n}):t.info(`our UUID not found`)}function ne(e){e.exec(`
    DROP INDEX   message_user_initiated;

    CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);
    `)}function re(e){e.exec(`
    DROP INDEX messages_preview;

    -- Note the omitted 'expiresAt' column in the index. If it is present
    -- sqlite can't ORDER BY received_at, sent_at using this index.
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, received_at, sent_at);
    `)}function ie(e){e.exec(`
    DROP INDEX messages_unread;

    -- Note: here we move to the modern isStory/storyId fields and add received_at/sent_at.
    CREATE INDEX messages_unread ON messages
      (conversationId, readStatus, isStory, storyId, received_at, sent_at) WHERE readStatus IS NOT NULL;
    `)}n.m();function ae(e,t){let r=e.prepare(`DELETE FROM jobs WHERE queueType = $queueType`),i=Yd(e,`reactions`);r.run({queueType:`reactions`});let a=e.prepare(`SELECT conversationId FROM messages WHERE id IS ?`);i.forEach(r=>{let{data:i,id:o}=r;if(!n.h(i)){t.warn(`reactions queue job ${o} was missing valid data`);return}let{messageId:s}=i;if(typeof s!=`string`){t.warn(`reactions queue job ${o} had a non-string messageId`);return}let c=a.get([s]);if(!c){t.warn(`Unable to find message for reaction job ${o}`);return}let{conversationId:l}=c;if(typeof l!=`string`){t.warn(`reactions queue job ${o} had a non-string conversationId`);return}X(e,{...r,queueType:`conversation`,data:{...i,type:`Reaction`,conversationId:l}})});let o=Yd(e,`normal send`);r.run({queueType:`normal send`}),o.forEach(r=>{let{data:i,id:a}=r;if(!n.h(i)){t.warn(`normal send queue job ${a} was missing valid data`);return}X(e,{...r,queueType:`conversation`,data:{...i,type:`NormalMessage`}})})}function oe(e){e.exec(`
    -- Create indices that don't have storyId in them so that
    -- '_storyIdPredicate' could be optimized.

    -- See migration 47
    CREATE INDEX messages_conversation_no_story_id ON messages
      (conversationId, isStory, received_at, sent_at);

    -- See migration 50
    CREATE INDEX messages_unread_no_story_id ON messages
      (conversationId, readStatus, isStory, received_at, sent_at)
      WHERE readStatus IS NOT NULL;
    `)}t.ct();function se(e,n){let r=e.prepare(`
      UPDATE conversations SET
        json = json_patch(json, $jsonPatch)
      WHERE id = $id;
    `),i=e=>{let t=e,i=`(${t.id}) groupv2(${t.groupId})`;if(!t.bannedMembersV2?.length)return!1;let a={bannedMembersV2:t.bannedMembersV2.map(e=>({uuid:e,timestamp:0}))};return n.info(`Updating ${i} with ${t.bannedMembersV2.length} banned members`),r.run({id:t.id,jsonPatch:JSON.stringify(a)}),!0},a=e.prepare(`
        SELECT json
        FROM conversations
        WHERE type = 'group'
        ORDER BY id ASC;
      `,{pluck:!0}).all().map(e=>t.lt(e));n.info(`About to iterate through ${a.length} conversations`);let o=0;for(let e of a)o+=+!!i(e);n.info(`Updated ${o} conversations`)}function ce(e){e.exec(`
      ALTER TABLE unprocessed ADD COLUMN receivedAtCounter INTEGER;
    `)}n.m(),i.fr();function le(e,t){let r=e.prepare(`DELETE FROM jobs WHERE queueType = $queueType`),a=Yd(e,`report spam`);r.run({queueType:`report spam`}),a.forEach(r=>{let{data:a,id:o}=r;if(!n.h(a)){t.warn(`report spam queue job ${o} was missing valid data`);return}let{e164:s,serverGuids:c}=a;if(typeof s!=`string`){t.warn(`report spam queue job ${o} had a non-string e164`);return}if(!i.mr(c)){t.warn(`report spam queue job ${o} had a non-iterable serverGuids`);return}X(e,{...r,queueType:`report spam`,data:{uuid:s,serverGuids:c}})})}t.x(),i.O();function ue(e){e.exec(`
    --- Add column to messages table

    ALTER TABLE messages ADD COLUMN seenStatus NUMBER default 0;

    --- Add index to make searching on this field easy

    CREATE INDEX messages_unseen_no_story ON messages
      (conversationId, seenStatus, isStory, received_at, sent_at)
      WHERE
        seenStatus IS NOT NULL;

    CREATE INDEX messages_unseen_with_story ON messages
      (conversationId, seenStatus, isStory, storyId, received_at, sent_at)
      WHERE
        seenStatus IS NOT NULL;

    --- Update seenStatus to UnseenStatus.Unseen for certain messages
    --- (NULL included because 'timer-notification' in 1:1 convos had type = NULL)

    UPDATE messages
      SET
        seenStatus = ${i.D.Unseen}
      WHERE
        readStatus = ${i.Z.Unread} AND
        (
          type IS NULL
          OR
          type IN (
            'call-history',
            'change-number-notification',
            'chat-session-refreshed',
            'delivery-issue',
            'group',
            'incoming',
            'keychange',
            'timer-notification',
            'verified-change'
          )
        );

    --- Set readStatus to ReadStatus.Read for all other message types

    UPDATE messages
      SET
        readStatus = ${i.Z.Read}
      WHERE
        readStatus = ${i.Z.Unread} AND
        type IS NOT NULL AND
        type NOT IN (
          'call-history',
          'change-number-notification',
          'chat-session-refreshed',
          'delivery-issue',
          'group',
          'incoming',
          'keychange',
          'timer-notification',
          'verified-change'
        );
    `)}function de(e){e.exec(`
    DELETE FROM messages
    WHERE type IS 'message-history-unsynced';
    `)}i.Q(),i.O();function T(e){e.exec(`
    --- Promote unread status in JSON to SQL column

    -- NOTE: This was disabled because the 'unread' json field was deprecated
    -- in b0750e5f4e1f79f0f177b17cbe06d688431f948d, but the old value was kept
    -- in the messages created before the release of that commit.
    --
    -- UPDATE messages
    --   SET
    --     readStatus = ${i.Z.Unread},
    --     seenStatus = ${i.D.Unseen}
    --   WHERE
    --     json_extract(json, '$.unread') IS true OR
    --     json_extract(json, '$.unread') IS 1;

    --- Clean up all old messages that still have a null read status
    ---   Note: we don't need to update seenStatus, because that was defaulted to zero

    UPDATE messages
      SET
        readStatus = ${i.Z.Read}
      WHERE
        readStatus IS NULL;

    --- Re-run unseen/unread queries from migration 56

    UPDATE messages
      SET
        seenStatus = ${i.D.Unseen}
      WHERE
        readStatus = ${i.Z.Unread} AND
        (
          type IS NULL
          OR
          type IN (
            'call-history',
            'change-number-notification',
            'chat-session-refreshed',
            'delivery-issue',
            'group',
            'incoming',
            'keychange',
            'timer-notification',
            'verified-change'
          )
        );

    UPDATE messages
      SET
        readStatus = ${i.Z.Read}
      WHERE
        readStatus = ${i.Z.Unread} AND
        type IS NOT NULL AND
        type NOT IN (
          'call-history',
          'change-number-notification',
          'chat-session-refreshed',
          'delivery-issue',
          'group',
          'incoming',
          'keychange',
          'timer-notification',
          'verified-change'
        );

    --- (new) Ensure these message types are not unread, just unseen

    UPDATE messages
      SET
        readStatus = ${i.Z.Read}
      WHERE
        readStatus = ${i.Z.Unread} AND
        (
          type IN (
            'change-number-notification',
            'keychange'
          )
        );

    --- (new) Ensure that these message types are neither unseen nor unread

    UPDATE messages
      SET
        readStatus = ${i.Z.Read},
        seenStatus = ${i.D.Seen}
      WHERE
        type IN (
          'group-v1-migration',
          'message-history-unsynced',
          'outgoing',
          'profile-change',
          'universal-timer-notification'
        );

    --- Make sure JSON reflects SQL columns

    UPDATE messages
      SET
        json = json_patch(
          json,
          json_object(
            'readStatus', readStatus,
            'seenStatus', seenStatus
          )
        )
      WHERE
        readStatus IS NOT NULL OR
        seenStatus IS NOT 0;
    `)}function fe(e){e.exec(`
      CREATE INDEX unprocessed_byReceivedAtCounter ON unprocessed
        (receivedAtCounter)
    `)}function pe(e){e.exec(`
    DROP INDEX expiring_message_by_conversation_and_received_at;

    CREATE INDEX expiring_message_by_conversation_and_received_at
      ON messages
      (
        conversationId,
        storyId,
        expirationStartTimestamp,
        expireTimer,
        received_at
      )
      WHERE isStory IS 0 AND type IS 'incoming';
    `)}function me(e){e.exec(`
    ALTER TABLE storyDistributions DROP COLUMN avatarKey;
    ALTER TABLE storyDistributions DROP COLUMN avatarUrlPath;

    ALTER TABLE storyDistributions ADD COLUMN deletedAtTimestamp INTEGER;
    ALTER TABLE storyDistributions ADD COLUMN allowsReplies INTEGER;
    ALTER TABLE storyDistributions ADD COLUMN isBlockList INTEGER;

    ALTER TABLE storyDistributions ADD COLUMN storageID STRING;
    ALTER TABLE storyDistributions ADD COLUMN storageVersion INTEGER;
    ALTER TABLE storyDistributions ADD COLUMN storageUnknownFields BLOB;
    ALTER TABLE storyDistributions ADD COLUMN storageNeedsSync INTEGER;

    ALTER TABLE messages ADD COLUMN storyDistributionListId STRING;

    CREATE INDEX messages_by_distribution_list
      ON messages(storyDistributionListId, received_at)
      WHERE storyDistributionListId IS NOT NULL;
    `)}function he(e){e.exec(`
    ALTER TABLE sendLogPayloads ADD COLUMN urgent INTEGER;
    `)}function ge(e){e.exec(`
    ALTER TABLE unprocessed ADD COLUMN urgent INTEGER;
    `)}function _e(e){e.exec(`
    ALTER TABLE preKeys
      ADD COLUMN ourUuid STRING
      GENERATED ALWAYS AS (json_extract(json, '$.ourUuid'));

    CREATE INDEX preKeys_ourUuid ON preKeys (ourUuid);

    ALTER TABLE signedPreKeys
      ADD COLUMN ourUuid STRING
      GENERATED ALWAYS AS (json_extract(json, '$.ourUuid'));

    CREATE INDEX signedPreKeys_ourUuid ON signedPreKeys (ourUuid);
    `)}function ve(e){e.exec(`
    ALTER TABLE sticker_packs ADD COLUMN position INTEGER DEFAULT 0 NOT NULL;
    ALTER TABLE sticker_packs ADD COLUMN storageID STRING;
    ALTER TABLE sticker_packs ADD COLUMN storageVersion INTEGER;
    ALTER TABLE sticker_packs ADD COLUMN storageUnknownFields BLOB;
    ALTER TABLE sticker_packs
    ADD COLUMN storageNeedsSync
    INTEGER DEFAULT 0 NOT NULL;

    CREATE TABLE uninstalled_sticker_packs (
      id STRING NOT NULL PRIMARY KEY,
      uninstalledAt NUMBER NOT NULL,
      storageID STRING,
      storageVersion NUMBER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL
    );

    -- Set initial position

    UPDATE sticker_packs
    SET
      position = (row_number - 1),
      storageNeedsSync = 1
    FROM (
      SELECT id, row_number() OVER (ORDER BY lastUsed DESC) as row_number
      FROM sticker_packs
    ) as ordered_pairs
    WHERE sticker_packs.id IS ordered_pairs.id;

    -- See: getAllStickerPacks

    CREATE INDEX sticker_packs_by_position_and_id ON sticker_packs (
      position ASC,
      id ASC
    );
    `)}function ye(e){e.exec(`
    ALTER TABLE sendLogPayloads
    ADD COLUMN hasPniSignatureMessage INTEGER DEFAULT 0 NOT NULL;
    `)}function be(e){e.exec(`
    ALTER TABLE unprocessed ADD COLUMN story INTEGER;
    `)}function xe(e){e.exec(`
    ALTER TABLE messages
      DROP COLUMN deprecatedSourceDevice;
    ALTER TABLE unprocessed
      DROP COLUMN deprecatedSourceDevice;
    `)}function Se(e){e.exec(`
    DROP TABLE IF EXISTS groupCallRings;

    CREATE TABLE groupCallRingCancellations(
      ringId INTEGER PRIMARY KEY,
      createdAt INTEGER NOT NULL
    );
    `)}function Ce(e){e.exec(`
    CREATE INDEX messages_by_storyId ON messages (storyId);
    `)}function we(e){e.exec(`
    --- These will be re-added below
    DROP INDEX messages_preview;
    DROP INDEX messages_activity;
    DROP INDEX message_user_initiated;

    --- These will also be re-added below
    ALTER TABLE messages DROP COLUMN shouldAffectActivity;
    ALTER TABLE messages DROP COLUMN shouldAffectPreview;
    ALTER TABLE messages DROP COLUMN isUserInitiatedMessage;

    --- Note: These generated columns were originally introduced in migration 47, and
    ---       are mostly the same
    
    --- Based on the current list (model-types.ts), the types which DO affect activity:
    ---   NULL (old, malformed data)
    ---   call-history
    ---   chat-session-refreshed (deprecated)
    ---   delivery-issue
    ---   group (deprecated)
    ---   group-v2-change
    ---   incoming
    ---   outgoing
    ---   timer-notification

    --- (change: added conversation-merge, keychange, and phone-number-discovery)
    ALTER TABLE messages
      ADD COLUMN shouldAffectActivity INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'phone-number-discovery',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- (change: added conversation-merge and phone-number-discovery
    ---    (now matches the above list)
    ALTER TABLE messages
      ADD COLUMN shouldAffectPreview INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'phone-number-discovery',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- Note: This list only differs from the above on these types:
    ---   group-v2-change

    --- (change: added conversation-merge and phone-number-discovery
    ALTER TABLE messages
      ADD COLUMN isUserInitiatedMessage INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'group-v2-change',
          'keychange',
          'message-history-unsynced',
          'phone-number-discovery',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, expiresAt, received_at, sent_at);

    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync, isGroupLeaveEventFromOther, received_at, sent_at);

    CREATE INDEX message_user_initiated ON messages (isUserInitiatedMessage);
    `)}function Te(e){e.exec(`
    ALTER TABLE messages
      ADD COLUMN callId TEXT
      GENERATED ALWAYS AS (
        json_extract(json, '$.callHistoryDetails.callId')
      );
    ALTER TABLE messages
      ADD COLUMN callMode TEXT
      GENERATED ALWAYS AS (
        json_extract(json, '$.callHistoryDetails.callMode')
      );
    CREATE INDEX messages_call ON messages
      (conversationId, type, callMode, callId);
    `)}function Ee(e){e.exec(`
    --- Delete deprecated notifications
    DELETE FROM messages WHERE type IS 'phone-number-discovery';

    --- These will be re-added below
    DROP INDEX messages_preview;
    DROP INDEX messages_activity;
    DROP INDEX message_user_initiated;

    --- These will also be re-added below
    ALTER TABLE messages DROP COLUMN shouldAffectActivity;
    ALTER TABLE messages DROP COLUMN shouldAffectPreview;
    ALTER TABLE messages DROP COLUMN isUserInitiatedMessage;

    --- Note: These generated columns were originally introduced in migration 71, and
    ---       are mostly the same

    --- (change: removed phone-number-discovery)
    ALTER TABLE messages
      ADD COLUMN shouldAffectActivity INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- (change: removed phone-number-discovery
    ---    (now matches the above list)
    ALTER TABLE messages
      ADD COLUMN shouldAffectPreview INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- Note: This list only differs from the above on these types:
    ---   group-v2-change

    --- (change: removed phone-number-discovery
    ALTER TABLE messages
      ADD COLUMN isUserInitiatedMessage INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'group-v2-change',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, expiresAt, received_at, sent_at);

    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync, isGroupLeaveEventFromOther, received_at, sent_at);

    CREATE INDEX message_user_initiated ON messages (isUserInitiatedMessage);
    `)}function De(e){e.exec(`
    -- Previously: (isUserInitiatedMessage)
    DROP INDEX message_user_initiated;

    CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);

    -- Previously: (unread, conversationId)
    DROP INDEX reactions_unread;

    CREATE INDEX reactions_unread ON reactions (
      conversationId,
      unread
    );
    `)}function Oe(){}function ke(e){e.exec(`
    -- Re-created below
    DROP INDEX IF EXISTS message_expires_at;
    DROP INDEX IF EXISTS messages_preview;

    -- Create non-null expiresAt column
    ALTER TABLE messages
      DROP COLUMN expiresAt;

    ALTER TABLE messages
      ADD COLUMN
      expiresAt INT
      GENERATED ALWAYS
      AS (ifnull(
        expirationStartTimestamp + (expireTimer * 1000),
        ${2**53-1}
      ));

    -- Re-create indexes
    -- Note the "s" at the end of "messages"
    CREATE INDEX messages_expires_at ON messages (
      expiresAt
    );

    -- Note that expiresAt is intentionally dropped from the index since
    -- expiresAt > $now is likely to be true so we just try selecting it
    -- *after* ordering by received_at/sent_at.
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at);
    CREATE INDEX messages_preview_without_story ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at) WHERE storyId IS NULL;
    `)}function Ae(e){e.exec(`
    -- Create FTS table with custom tokenizer from
    -- @signalapp/sqlcipher.

    DROP TABLE messages_fts;

    CREATE VIRTUAL TABLE messages_fts USING fts5(
      body,
      tokenize = 'signal_tokenizer'
    );

    -- Reindex messages
    -- Based on messages_on_insert trigger from migrations/45-stories.ts

    INSERT INTO messages_fts (rowid, body)
    SELECT rowid, body
    FROM messages
    WHERE isViewOnce IS NOT 1 AND storyId IS NULL;
    `)}n.m();function je(e,t){let r=e.prepare(`DELETE FROM jobs WHERE queueType = $queueType`),i=[{queueType:`delivery receipts`,jobDataKey:`deliveryReceipts`,jobDataIsArray:!0,newReceiptsType:`deliveryReceipt`},{queueType:`read receipts`,jobDataKey:`readReceipts`,jobDataIsArray:!0,newReceiptsType:`readReceipt`},{queueType:`viewed receipts`,jobDataKey:`viewedReceipt`,jobDataIsArray:!1,newReceiptsType:`viewedReceipt`}],a=e.prepare(`SELECT conversationId FROM messages WHERE id IS ?`);for(let o of i){let i=Yd(e,o.queueType);r.run({queueType:o.queueType}),i.forEach(r=>{let{data:i,id:s}=r;if(!n.h(i)){t.warn(`${o.queueType} queue job ${s} was missing valid data`);return}let{messageId:c}=i;if(typeof c!=`string`){t.warn(`${o.queueType} queue job ${s} had a non-string messageId`);return}let l=a.get([c]);if(!l){t.warn(`Unable to find message for ${o.queueType} job ${s}`);return}let{conversationId:u}=l;if(typeof u!=`string`){t.warn(`${o.queueType} queue job ${s} had a non-string conversationId`);return}let d=o.jobDataIsArray?i[o.jobDataKey]:[i[o.jobDataKey]];if(!Array.isArray(d)){t.warn(`${o.queueType} queue job ${s} had a non-array ${o.jobDataKey}`);return}let f=[];for(let e of d){if(!n.h(e)){t.warn(`${o.queueType} queue job ${s} had a non-record receipt`);continue}f.push({...e,conversationId:u})}X(e,{...r,queueType:`conversation`,data:{type:`Receipts`,conversationId:u,receiptsType:o.newReceiptsType,receipts:f}})})}}function Me(e){e.exec(`
    DROP INDEX   messages_hasVisualMediaAttachments;
    CREATE INDEX messages_hasVisualMediaAttachments
      ON messages (
        conversationId, isStory, storyId,
        hasVisualMediaAttachments, received_at, sent_at
      )
      WHERE hasVisualMediaAttachments IS 1;
  `)}function Ne(e){e.exec(`
    CREATE TABLE edited_messages(
      fromId STRING,
      messageId STRING REFERENCES messages(id)
        ON DELETE CASCADE,
      sentAt INTEGER,
      readStatus INTEGER
    );

    CREATE INDEX edited_messages_sent_at ON edited_messages (sentAt);
  `)}function Pe(e){e.exec(`
    --- These will be re-added below
    DROP INDEX messages_preview;
    DROP INDEX messages_preview_without_story;
    DROP INDEX messages_activity;
    DROP INDEX message_user_initiated;

    --- These will also be re-added below
    ALTER TABLE messages DROP COLUMN shouldAffectActivity;
    ALTER TABLE messages DROP COLUMN shouldAffectPreview;
    ALTER TABLE messages DROP COLUMN isUserInitiatedMessage;

    --- Note: These generated columns were previously modified in
    ---       migration 73, and are mostly the same

    --- (change: added contact-removed-notification)
    ALTER TABLE messages
      ADD COLUMN shouldAffectActivity INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'contact-removed-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- (change: added contact-removed-notification)
    ALTER TABLE messages
      ADD COLUMN shouldAffectPreview INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'contact-removed-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- (change: added contact-removed-notification)
    ALTER TABLE messages
      ADD COLUMN isUserInitiatedMessage INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'contact-removed-notification',
          'conversation-merge',
          'group-v1-migration',
          'group-v2-change',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- From migration 76
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at);

    --- From migration 76
    CREATE INDEX messages_preview_without_story ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at) WHERE storyId IS NULL;

    --- From migration 73
    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync, isGroupLeaveEventFromOther, received_at, sent_at);

    --- From migration 74
    CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);
    `)}function Fe(e){e.exec(`
    ALTER TABLE edited_messages DROP COLUMN fromId;
    ALTER TABLE edited_messages ADD COLUMN conversationId STRING;

    CREATE INDEX edited_messages_unread ON edited_messages (readStatus, conversationId);
  `)}function Ie(e){e.exec(`
    ALTER TABLE messages
      ADD COLUMN mentionsMe INTEGER NOT NULL DEFAULT 0;

    -- one which includes story data...
    CREATE INDEX messages_unread_mentions ON messages
      (conversationId, readStatus, mentionsMe, isStory, storyId, received_at, sent_at)
      WHERE readStatus IS NOT NULL;

    -- ...and one which doesn't, so storyPredicate works as expected
    CREATE INDEX messages_unread_mentions_no_story_id ON messages
      (conversationId, readStatus, mentionsMe, isStory, received_at, sent_at)
      WHERE isStory IS 0 AND readStatus IS NOT NULL;
    `)}function Le(e){let t=`
    SELECT messages.id, bodyRanges.value ->> 'mentionUuid' as mentionUuid, bodyRanges.value ->> 'start' as start, bodyRanges.value ->> 'length' as length 
    FROM messages, json_each(messages.json ->> 'bodyRanges') as bodyRanges
    WHERE bodyRanges.value ->> 'mentionUuid' IS NOT NULL
  `;e.exec(`
    DROP TABLE IF EXISTS mentions;

    CREATE TABLE mentions (
      messageId REFERENCES messages(id) ON DELETE CASCADE,
      mentionUuid STRING,
      start INTEGER,
      length INTEGER
    );

    CREATE INDEX mentions_uuid ON mentions (mentionUuid);

    INSERT INTO mentions (messageId, mentionUuid, start, length)
    ${t};

    -- Note: any changes to this trigger must be reflected in 
    -- Server.ts: enableMessageInsertTriggersAndBackfill
    CREATE TRIGGER messages_on_insert_insert_mentions AFTER INSERT ON messages
    BEGIN
      INSERT INTO mentions (messageId, mentionUuid, start, length)
      ${t} 
      AND messages.id = new.id;
    END;

    CREATE TRIGGER messages_on_update_update_mentions AFTER UPDATE ON messages
    BEGIN
      DELETE FROM mentions WHERE messageId = new.id;
      INSERT INTO mentions (messageId, mentionUuid, start, length)
      ${t} 
      AND messages.id = new.id;
    END;
  `)}function Re(e){e.exec(`CREATE TABLE kyberPreKeys(
      id STRING PRIMARY KEY NOT NULL,
      json TEXT NOT NULL,
      ourUuid STRING
        GENERATED ALWAYS AS (json_extract(json, '$.ourUuid'))
    );`),e.exec(`CREATE INDEX kyberPreKeys_ourUuid ON kyberPreKeys (ourUuid);`);let t=Date.now();e.exec(`UPDATE preKeys SET
      json = json_set(json, '$.createdAt', ${t});
    `)}function ze(e){e.exec(`CREATE INDEX messages_story_replies
      ON messages (storyId, received_at, sent_at)
      WHERE isStory IS 0;
    `)}t.ct();function Be(e,n){return Ve(e,n,`kyberPreKeys`,t.gt`kyberPreKeys`,t.gt`createdAt`,t.gt`ourServiceId`),Ve(e,n,`signedPreKeys`,t.gt`signedPreKeys`,t.gt`created_at`,t.gt`ourServiceId`),n.info(`Done with deletions, starting vacuum...`),`vacuum`}function Ve(e,n,r,a,o,s){let c,l=e.prepare(`SELECT json FROM items WHERE id IS 'pni'`,{pluck:!0}).get();try{c=i.Mr(JSON.parse(l??``).value,r)}catch(e){l?n.warn(`${r}: PNI found but did not parse`,t._i(e)):n.info(`${r}: Our PNI not found`);return}let u=e.prepare(t.mt`SELECT count(*) FROM ${a};`[0],{pluck:!0}).get()??0;if(n.info(`${r}: Found ${u} total keys`),u<1e3)return;let[d,f]=t.mt`SELECT count(*) from ${a} WHERE ${s} = ${c}`,p=e.prepare(d,{pluck:!0}).get(f);n.info(`${r}: Found ${p} keys for PNI`),e.exec(t.mt`
      ALTER TABLE ${a}
        ADD COLUMN createdAt NUMBER
          GENERATED ALWAYS AS (json_extract(json, '$.${o}'));

      CREATE INDEX ${a}_date
        ON ${a} (${s}, createdAt);
    `[0]),n.info(`${r}: Temporary index created`);let[m,h]=t.mt`
    SELECT createdAt
    FROM ${a}
    WHERE
      createdAt IS NOT NULL AND
      ${s} = ${c}
    ORDER BY createdAt ASC
    LIMIT 1
    OFFSET 499
  `,g=e.prepare(m,{pluck:!0}).get(h);n.info(`${r}: Found 500th-oldest timestamp: ${g}`);let[_,v]=t.mt`
    SELECT createdAt
    FROM ${a}
    WHERE
      createdAt IS NOT NULL AND
      ${s} = ${c}
    ORDER BY createdAt DESC
    LIMIT 1
    OFFSET 499
  `,y=e.prepare(_,{pluck:!0}).get(v);n.info(`${r}: Found 500th-newest timestamp: ${y}`);let b,[x,S]=t.mt`
    DELETE FROM ${a}
    WHERE
      createdAt IS NOT NULL AND
      createdAt > ${g??null} AND
      createdAt < ${y??null} AND
      ${s} = ${c}
    LIMIT 10000;
  `,ee=e.prepare(x);do b=ee.run(S),n.info(`${r}: Deleted ${b.changes} keys`);while(b.changes>0);n.info(`${r}: Delete is complete!`);let[te,C]=t.mt`
    SELECT count(*)
    FROM ${a}
    WHERE ${s} = ${c};
  `,w=e.prepare(te,{pluck:!0}).get(C);n.info(`${r}: Found ${w} keys for PNI after delete`),e.exec(t.mt`
      DROP INDEX ${a}_date;
      ALTER TABLE ${a} DROP COLUMN createdAt;
    `[0])}t.ct();function He(e,n,r){r>=88||(Ve(e,n,`(cleanup)/kyberPreKeys`,t.gt`kyberPreKeys`,t.gt`createdAt`,t.gt`ourUuid`),Ve(e,n,`(cleanup)/preKeys`,t.gt`preKeys`,t.gt`createdAt`,t.gt`ourUuid`),Ve(e,n,`(cleanup)/signedPreKeys`,t.gt`signedPreKeys`,t.gt`created_at`,t.gt`ourUuid`))}i.Or(),i.Hn(),t.ai();const{omit:E}=m.default;function Ue(e,t){let n=`
    SELECT messages.id, bodyRanges.value ->> 'mentionAci' as mentionAci,
      bodyRanges.value ->> 'start' as start,
      bodyRanges.value ->> 'length' as length
    FROM messages, json_each(messages.json ->> 'bodyRanges') as bodyRanges
    WHERE bodyRanges.value ->> 'mentionAci' IS NOT NULL
  `;e.exec(`
    --
    -- conversations
    --

    DROP INDEX conversations_uuid;

    ALTER TABLE conversations
      RENAME COLUMN uuid TO serviceId;

    -- See: updateToSchemaVersion20
    CREATE INDEX conversations_serviceId ON conversations(serviceId);

    --
    -- sessions
    --

    ALTER TABLE sessions
      RENAME COLUMN ourUuid TO ourServiceId;
    ALTER TABLE sessions
      RENAME COLUMN uuid TO serviceId;

    --
    -- messages
    --

    DROP INDEX messages_sourceUuid;
    DROP INDEX messages_preview;
    DROP INDEX messages_preview_without_story;
    DROP INDEX messages_activity;

    ALTER TABLE messages
      DROP COLUMN isGroupLeaveEventFromOther;
    ALTER TABLE messages
      DROP COLUMN isGroupLeaveEvent;

    ALTER TABLE messages
      RENAME COLUMN sourceUuid TO sourceServiceId;

    -- See: updateToSchemaVersion47
    ALTER TABLE messages
      ADD COLUMN isGroupLeaveEvent INTEGER
      GENERATED ALWAYS AS (
        type IS 'group-v2-change' AND
        json_array_length(json_extract(json, '$.groupV2Change.details')) IS 1 AND
        json_extract(json, '$.groupV2Change.details[0].type') IS 'member-remove' AND
        json_extract(json, '$.groupV2Change.from') IS NOT NULL AND
        json_extract(json, '$.groupV2Change.from') IS json_extract(json, '$.groupV2Change.details[0].aci')
      );

    ALTER TABLE messages
      ADD COLUMN isGroupLeaveEventFromOther INTEGER
      GENERATED ALWAYS AS (
        isGroupLeaveEvent IS 1
        AND
        isChangeCreatedByUs IS 0
      );

    -- See: updateToSchemaVersion25
    CREATE INDEX messages_sourceServiceId on messages(sourceServiceId);

    -- See: updateToSchemaVersion81
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at);
    CREATE INDEX messages_preview_without_story ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at) WHERE storyId IS NULL;
    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync,
       isGroupLeaveEventFromOther, received_at, sent_at);

    --
    -- reactions
    --

    DROP INDEX reaction_identifier;

    ALTER TABLE reactions
      RENAME COLUMN targetAuthorUuid TO targetAuthorAci;

    -- See: updateToSchemaVersion29
    CREATE INDEX reaction_identifier ON reactions (
      emoji,
      targetAuthorAci,
      targetTimestamp
    );

    --
    -- unprocessed
    --

    ALTER TABLE unprocessed
      RENAME COLUMN sourceUuid TO sourceServiceId;

    --
    -- sendLogRecipients
    --

    DROP INDEX sendLogRecipientsByRecipient;

    ALTER TABLE sendLogRecipients
      RENAME COLUMN recipientUuid TO recipientServiceId;

    -- See: updateToSchemaVersion37
    CREATE INDEX sendLogRecipientsByRecipient
      ON sendLogRecipients (recipientServiceId, deviceId);

    --
    -- storyDistributionMembers
    --

    ALTER TABLE storyDistributionMembers
      RENAME COLUMN uuid TO serviceId;

    --
    -- mentions
    --

    DROP TRIGGER messages_on_update;
    DROP TRIGGER messages_on_insert_insert_mentions;
    DROP TRIGGER messages_on_update_update_mentions;
    DROP INDEX mentions_uuid;

    ALTER TABLE mentions
      RENAME COLUMN mentionUuid TO mentionAci;

    -- See: updateToSchemaVersion84
    CREATE INDEX mentions_aci ON mentions (mentionAci);

    --
    -- preKeys
    --

    DROP INDEX preKeys_ourUuid;
    DROP INDEX signedPreKeys_ourUuid;
    DROP INDEX kyberPreKeys_ourUuid;

    ALTER TABLE preKeys
      RENAME COLUMN ourUuid TO ourServiceId;
    ALTER TABLE signedPreKeys
      RENAME COLUMN ourUuid TO ourServiceId;
    ALTER TABLE kyberPreKeys
      RENAME COLUMN ourUuid TO ourServiceId;

    -- See: updateToSchemaVersion64
    CREATE INDEX preKeys_ourServiceId ON preKeys (ourServiceId);
    CREATE INDEX signedPreKeys_ourServiceId ON signedPreKeys (ourServiceId);
    CREATE INDEX kyberPreKeys_ourServiceId ON kyberPreKeys (ourServiceId);
  `);let{identifierToServiceId:r}=We(e,t),i=Ge(e,t);Ke(e,i,t),qe(e,t),Je(e,`preKeys`,i,t),Je(e,`signedPreKeys`,i,t),Je(e,`kyberPreKeys`,i,t),Ye(e,r,t),e.exec(`
    -- See: updateToSchemaVersion45
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN
      (new.body IS NULL OR old.body IS NOT new.body) AND
       new.isViewOnce IS NOT 1 AND new.storyId IS NULL
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
        (rowid, body)
      VALUES
        (new.rowid, new.body);
    END;

    -- See: updateToSchemaVersion84
    CREATE TRIGGER messages_on_insert_insert_mentions AFTER INSERT ON messages
    BEGIN
      INSERT INTO mentions (messageId, mentionAci, start, length)
      ${n}
      AND messages.id = new.id;
    END;

    CREATE TRIGGER messages_on_update_update_mentions AFTER UPDATE ON messages
    BEGIN
      DELETE FROM mentions WHERE messageId = new.id;
      INSERT INTO mentions (messageId, mentionAci, start, length)
      ${n}
      AND messages.id = new.id;
    END;
  `)}function We(e,n){let r=e.prepare(`SELECT id, e164, serviceId, json FROM conversations`).all(),a=e.prepare(`UPDATE conversations SET json = $json WHERE id IS $id`);n.info(`updating ${r.length} conversations`);let o=new Map;for(let{id:e,e164:t,serviceId:a}of r){if(!a)continue;let r=i.Nr(a,`legacyConvo.serviceId`,n);o.set(e,r),t&&o.set(t,r),o.set(r,r)}for(let{id:e,json:s}of r)try{let{uuid:r,pni:c,bannedMembersV2:l,membersV2:u,pendingAdminApprovalV2:d,pendingMembersV2:f,lastMessageBodyRanges:p,senderKeyInfo:m,...h}=JSON.parse(s),g={...h,serviceId:i.Nr(r,`legacyConvo.serviceId`,n),pni:Ze(c,`legacyConvo.pni`,n),bannedMembersV2:l?.map(({uuid:e,...t})=>({...t,serviceId:i.Nr(e,`legacyConvo.bannedMembersV2`,n)})),membersV2:u?.map(({uuid:e,...t})=>({...t,aci:i.Un(e,`legacyConvo.membersV2`,n)})),pendingAdminApprovalV2:d?.map(({uuid:e,...t})=>({...t,aci:i.Un(e,`legacyConvo.pendingAdminApprovalV2`,n)})),pendingMembersV2:f?.map(({uuid:e,...t})=>({...t,serviceId:i.Nr(e,`legacyConvo.pendingMembersV2`,n)})),lastMessageBodyRanges:Qe(p,`lastMessageBodyRanges`,n),senderKeyInfo:m?{...m,memberDevices:m.memberDevices.map(({identifier:e,...t})=>{let r=o.get(e);if(!r){n.warn(`failed to resolve identifier ${e}`);return}return{...t,serviceId:r}}).filter(t.oi)}:void 0};a.run({id:e,json:JSON.stringify(g)})}catch(t){n.warn(`failed to parse convo ${e} json`,t);continue}return{identifierToServiceId:o}}function Ge(e,t){let n=e.prepare(`
    SELECT json
    FROM items
    WHERE id IS 'uuid_id'
  `,{pluck:!0}).get(),r=e.prepare(`
    SELECT json
    FROM items
    WHERE id IS 'pni'
  `,{pluck:!0}).get(),a;try{[a]=JSON.parse(n??``).value.split(`.`,2)}catch(e){n?t.warn(`failed to parse uuid_id item`,e):t.info(`Our UUID not found`)}let o;try{o=JSON.parse(r??``).value}catch(e){r?t.warn(`failed to parse pni item`,e):t.info(`Our PNI not found`)}let s=i.Un(a,`uuid_id`,t),c=Ze(o,`pni`,t),l=e.prepare(`
      SELECT id, json
      FROM items
      WHERE id IN ('identityKeyMap', 'registrationIdMap');
    `).all(),u=e.prepare(`UPDATE items SET json = $json WHERE id IS $id`);c&&u.run({id:`pni`,json:JSON.stringify({id:`pni`,value:c})});for(let{id:e,json:n}of l)try{let t=JSON.parse(n),r=a&&t.value[a];a&&s&&r&&(delete t.value[a],t.value[s]=r);let i=o&&t.value[o];o&&c&&i&&(delete t.value[o],t.value[c]=i),u.run({id:e,json:JSON.stringify(t)})}catch(n){t.warn(`failed to parse ${e} item`,n)}return{aci:s,pni:c,legacyAci:a,legacyPni:o}}function Ke(e,t,n){let r=e.prepare(`SELECT id, serviceId, ourServiceId, json FROM sessions`).all(),i=e.prepare(`
      UPDATE sessions
      SET id = $newId, serviceId = $newServiceId,
        ourServiceId = $newOurServiceId, json = $newJson
      WHERE id IS $id
    `);n.info(`updating ${r.length} sessions`);for(let{id:e,serviceId:a,ourServiceId:o,json:s}of r){let r=e.match(/^(.*):(.*)\.(.*)$/);if(!r){n.warn(`invalid session id ${e}`);continue}let c;try{c=JSON.parse(s)}catch(t){n.warn(`failed to parse session ${e}`,t);continue}let[,l,u,d]=r,f=`${D(l,t,n)}:${D(u,t,n)}.${d}`,p=D(a,t,n),m=D(o,t,n);if(!p||!m){n.warn(`failed to normalize session service ids`,a,o);continue}let h={...E(c,`uuid`,`ourUuid`),id:f,serviceId:p,ourServiceId:m};i.run({id:e,newId:f,newServiceId:p,newOurServiceId:m,newJson:JSON.stringify(h)})}}function qe(e,t){let n=1e4,r=e.prepare(`
    SELECT rowid, id, json
    FROM messages
    LIMIT $limit
    OFFSET $offset
  `),a=e.prepare(`
    UPDATE messages
    SET json = $json
    WHERE rowid = $rowid
  `);t.info(`updating messages`);let o=0;for(let e=0;;e+=n){let s=r.all({limit:n,offset:e});if(s.length===0)break;o+=s.length;for(let{rowid:e,id:n,json:r}of s)try{let n=JSON.parse(r),{sourceUuid:o,expirationTimerUpdate:s,reactions:c,storyReaction:l,storyReplyContext:u,editHistory:d,groupV2Change:f,...p}=n,m={...p,...E(Xe(n,`message`,t),`sourceUuid`),sourceServiceId:i.Nr(o,`sourceUuid`),expirationTimerUpdate:s?{...E(s,`sourceUuid`),sourceServiceId:i.Nr(s.sourceUuid,`expirationTimerUpdate.sourceUuid`)}:void 0,reactions:c?.map(e=>$e(e)),storyReaction:l?$e(l):void 0,storyReplyContext:u?{...E(u,`authorUuid`),authorAci:i.Un(u.authorUuid,`storyReplyContext.authorUuid`,t)}:void 0,editHistory:d?.map(e=>Xe(e,`editHistory`,t)),groupV2Change:f?{...f,details:f.details?.map(e=>tt(e,t))}:void 0};a.run({rowid:e,json:JSON.stringify(m)})}catch(e){t.warn(`failed to parse message ${n} json`,e)}}t.info(`updated ${o} messages`)}function Je(e,t,n,r){let i=e.prepare(`SELECT id, json FROM ${t}`).all(),a=e.prepare(`
    UPDATE ${t}
    SET id = $newId, json = $newJson
    WHERE id = $id
  `);r.info(`updating ${i.length} ${t}`);for(let{id:e,json:o}of i){let i=e.match(/^(.*):(.*)$/);if(!i){r.warn(`invalid ${t} id ${e}`);continue}let s;try{s=JSON.parse(o)}catch(n){r.warn(`failed to parse ${t} ${e}`,n);continue}let[,c,l]=i,u=D(c,n,r),d=`${u}:${l}`,f={...E(s,`ourUuid`),id:d,ourServiceId:u};a.run({id:e,newId:d,newJson:JSON.stringify(f)})}}function Ye(e,t,n){let r=e.prepare(`SELECT id, queueType, data FROM jobs`).all(),a=e.prepare(`UPDATE jobs SET data = $data WHERE id IS $id`),o=0;for(let{id:e,queueType:s,data:c}of r)try{let r=JSON.parse(c),l;if(s===`conversation`){let e=r,t;e.type===`DeleteStoryForEveryone`?t={...e,updatedStoryRecipients:e.updatedStoryRecipients.map(({destinationUuid:e,legacyDestinationUuid:t,destinationAci:r,destinationPni:a,...o})=>({...o,destinationServiceId:i.Nr(e||r||a||t,`DeleteStoryForEveryone`,n)}))}:e.type===`ResendRequest`?t={...E(e,`senderUuid`),senderAci:i.Un(e.senderUuid,`ResendRequest`,n)}:e.type===`Receipts`&&(t={...e,receipts:e.receipts.map(({senderUuid:e,...t})=>({...t,senderAci:i.Un(e,`Receipts`,n)}))}),l=t}else if(s===`read sync`){let e=r;l={...e,readSyncs:e.readSyncs.map(({senderUuid:e,...t})=>({...t,senderAci:i.Un(e,`read sync`)}))}}else if(s===`view sync`){let e=r;l={...e,viewSyncs:e.viewSyncs.map(({senderUuid:e,...t})=>({...t,senderAci:i.Un(e,`read sync`)}))}}else if(s===`view once open sync`){let e=r;l={...e,viewOnceOpens:e.viewOnceOpens.map(({senderUuid:e,...t})=>({...t,senderAci:i.Un(e,`read sync`)}))}}else if(s===`single proto`){let{identifier:i,...a}=r,o=t.get(i);if(!o){n.warn(`failed to resolve identifier ${i} for job ${e}/${s}`);continue}l={...a,serviceId:o}}l!==void 0&&(o+=1,a.run({id:e,data:JSON.stringify(l)}))}catch(t){n.warn(`failed to migrate job ${e}/${s} json`,t)}n.info(`updated ${o} jobs`)}function Xe({bodyRanges:e,quote:t,...n},r,a){return{...n,bodyRanges:e?Qe(e,`${r}.bodyRanges`,a):void 0,quote:t?{...t,authorAci:i.Un(t.authorUuid,`${r}.quote.authorUuid`,a),bodyRanges:t.bodyRanges?Qe(t.bodyRanges,`${r}.quote.bodyRanges`,a):void 0}:void 0}}function D(e,{legacyAci:t,legacyPni:n,aci:r,pni:a},o){if(e!=null)return e===t?r:e===n?a:i.Nr(e,`migrateServiceId(${e})`,o)}function Ze(e,t,n){if(e!=null)return e.toLowerCase().startsWith(`pni:`)?i.Mr(e,t,n):i.Mr(`PNI:${e}`,t,n)}function Qe(e,t,n){if(e!=null)return e?.map(({mentionUuid:e,...r})=>({...r,mentionAci:i.Un(e,t,n)}))}function $e(e){return E(e,`targetAuthorUuid`)}const et=new Set([`pending-add-one`,`pending-remove-one`]);function tt({type:e,uuid:t,...n},r){let a,o;return et.has(e)?o=i.Nr(t,`migrateGroupChange(${e})`,r):a=i.Un(t,`migrateGroupChange(${e})`,r),{...n,type:e,aci:a,serviceId:o}}t.ct(),i.vt(),t.qr(),t.Xr();const{isObject:nt}=m.default;function rt(e){if(e.callMode===i.it.Direct||e.callMode===i.it.Group)return e;if(Object.hasOwn(e,`wasIncoming`)&&Object.hasOwn(e,`wasVideoCall`))return{callMode:i.it.Direct,...e};if(Object.hasOwn(e,`eraId`)&&Object.hasOwn(e,`startedTime`))return{callMode:i.it.Group,...e};throw Error(`Could not determine call mode`)}function it(e,n){return e.type===`private`?e.serviceId==null?(n.warn(`Private conversation (${e.id}) was missing serviceId (discoveredUnregisteredAt: ${e.discoveredUnregisteredAt})`),e.id):(t.Yr(i.zr(e.serviceId),`ACI must exist for direct chat`),e.serviceId):(t.Yr(e.groupId!=null,`groupId must exist for group chat`),e.groupId)}function at(e,r,a,o,s){let c=rt(o),{callMode:l}=c,u,d,p,m,h,g=null;t.Yr(l!=null,`mode must exist`);let _=a.timestamp??a.sent_at??a.received_at_ms??0;if(l===i.it.Direct)u=c.callId??t.v(),d=c.wasVideoCall?i.ot.Video:i.ot.Audio,p=c.wasIncoming?i.tt.Incoming:i.tt.Outgoing,m=c.acceptedTime==null?c.wasDeclined?i.ct.Declined:i.ct.Missed:i.ct.Accepted,h=c.acceptedTime??c.endedTime??_;else if(l===i.it.Group)u=(0,f.callIdFromEra)(c.eraId).toString(),d=i.ot.Group,p=c.creatorUuid===e?i.tt.Outgoing:i.tt.Incoming,m=i.lt.GenericGroupCall,h=c.startedTime??_,g=c.creatorUuid;else throw n.p(l);let v=t.ri(i.ht,{callId:u,peerId:r,ringerId:g,mode:l,type:d,direction:p,status:m,timestamp:h,startedById:null,endedTimestamp:null});if(v.success)return v.data;throw s.error(`convertLegacyCallDetails: Could not convert ${l} call`,v.error.toString()),Error(`Failed to convert legacy ${l} call details`)}function ot(e,n){let r=v(e),[i]=t.mt`
    -- This table may have already existed from migration 87
    CREATE TABLE IF NOT EXISTS callsHistory (
      callId TEXT PRIMARY KEY,
      peerId TEXT NOT NULL, -- conversation id (legacy) | uuid | groupId | roomId
      ringerId TEXT DEFAULT NULL, -- ringer uuid
      mode TEXT NOT NULL, -- enum "Direct" | "Group"
      type TEXT NOT NULL, -- enum "Audio" | "Video" | "Group"
      direction TEXT NOT NULL, -- enum "Incoming" | "Outgoing
      -- Direct: enum "Pending" | "Missed" | "Accepted" | "Deleted"
      -- Group: enum "GenericGroupCall" | "OutgoingRing" | "Ringing" | "Joined" | "Missed" | "Declined" | "Accepted" | "Deleted"
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      UNIQUE (callId, peerId) ON CONFLICT FAIL
    );

    -- Update peerId to be uuid or groupId
    UPDATE callsHistory
      SET peerId = (
        SELECT
          CASE
            WHEN conversations.type = 'private' THEN conversations.serviceId
            WHEN conversations.type = 'group' THEN conversations.groupId
          END
        FROM conversations
        WHERE callsHistory.peerId IS conversations.id
          AND callsHistory.peerId IS NOT conversations.serviceId
      )
      WHERE EXISTS (
        SELECT 1
        FROM conversations
        WHERE callsHistory.peerId IS conversations.id
          AND callsHistory.peerId IS NOT conversations.serviceId
      );

    CREATE INDEX IF NOT EXISTS callsHistory_order on callsHistory (timestamp DESC);
    CREATE INDEX IF NOT EXISTS callsHistory_byConversation ON callsHistory (peerId);
    -- For 'getCallHistoryGroupData':
    -- This index should target the subqueries for 'possible_parent' and 'possible_children'
    CREATE INDEX IF NOT EXISTS callsHistory_callAndGroupInfo_optimize on callsHistory (
      direction,
      peerId,
      timestamp DESC,
      status
    );
  `;e.exec(i);let[a]=t.mt`
    SELECT
      messages.json AS messageJson,
      conversations.id AS conversationId,
      conversations.json AS conversationJson
    FROM messages
    LEFT JOIN conversations ON conversations.id = messages.conversationId
    WHERE messages.type = 'call-history'
    -- Some of these messages were already migrated
    AND messages.json->'callHistoryDetails' IS NOT NULL
    -- Sort from oldest to newest, so that newer messages can overwrite older
    ORDER BY messages.received_at ASC, messages.sent_at ASC;
  `,o=e.prepare(a).all();for(let i of o){let{messageJson:a,conversationId:o,conversationJson:s}=i,c=t.lt(a),l=t.lt(s);if(!nt(l)){n.warn(`Private conversation (${o}) has non-object json column`);continue}let u=c.callHistoryDetails,d=at(r,it(l,n),c,u,n),[f,p]=t.mt`
      -- Using 'OR REPLACE' because in some earlier versions of call history
      -- we had a bug where we would insert duplicate call history entries
      -- for the same callId and peerId.
      -- We're assuming here that the latest call history entry is the most
      -- accurate.
      INSERT OR REPLACE INTO callsHistory (
        callId,
        peerId,
        ringerId,
        mode,
        type,
        direction,
        status,
        timestamp
      ) VALUES (
        ${d.callId},
        ${d.peerId},
        ${d.ringerId},
        ${d.mode},
        ${d.type},
        ${d.direction},
        ${d.status},
        ${d.timestamp}
      )
    `;e.prepare(f).run(p);let m=c.id;t.Yr(m!=null,`message.id must exist`);let[h,g]=t.mt`
      UPDATE messages
      SET json = JSON_PATCH(json, ${JSON.stringify({callHistoryDetails:null,callId:d.callId})})
      WHERE id = ${m}
    `;e.prepare(h).run(g)}let[s]=t.mt`
    DROP INDEX IF EXISTS messages_call;
  `;e.exec(s);try{let[n]=t.mt`
      ALTER TABLE messages
        DROP COLUMN callMode;
    `;e.exec(n)}catch(e){if(!e.message.includes(`no such column: "callMode"`))throw e}try{let[n]=t.mt`
      ALTER TABLE messages
        DROP COLUMN callId;
    `;e.exec(n)}catch(e){if(!e.message.includes(`no such column: "callId"`))throw e}let[c]=t.mt`
    ALTER TABLE messages
      ADD COLUMN callId TEXT
      GENERATED ALWAYS AS (
        json_extract(json, '$.callId')
      );
    -- Optimize getCallHistoryMessageByCallId
    CREATE INDEX messages_call ON messages
      (conversationId, type, callId);

    CREATE INDEX messages_callHistory_readStatus ON messages
      (type, readStatus)
      WHERE type IS 'call-history';
  `;e.exec(c)}t.Pr(),t.Cr();var st=t.c();t.s(),t.ct();function ct(e,n){let r=0,[i,a]=t.mt`
      UPDATE messages
      SET json = json_remove(json, '$.storyReplyContext.attachment.screenshotData')
      WHERE isStory = 0

      /* we want to find all messages with a non-null storyId, but using string 
      comparison (instead of a non-null check) here causes Sqlite to use the 
      storyId index */
      AND storyId > '0' 

      AND json->'$.storyReplyContext.attachment.screenshotData' IS NOT NULL;
  `;r=e.prepare(i).run(a).changes,n.info(`removed screenshotData from ${r} message${r>1?`s`:``}`)}t.ct(),i.Or(),t.hi();function lt(e,n){e.exec(`
    --- First, prekeys
    DROP INDEX preKeys_ourServiceId;

    ALTER TABLE preKeys
      DROP COLUMN ourServiceId;
    ALTER TABLE preKeys
      ADD COLUMN ourServiceId NUMBER
      GENERATED ALWAYS AS (json_extract(json, '$.ourServiceId'));

    CREATE INDEX preKeys_ourServiceId ON preKeys (ourServiceId);

    -- Second, kyber prekeys

    DROP INDEX kyberPreKeys_ourServiceId;

    ALTER TABLE kyberPreKeys
      DROP COLUMN ourServiceId;
    ALTER TABLE kyberPreKeys
      ADD COLUMN ourServiceId NUMBER
      GENERATED ALWAYS AS (json_extract(json, '$.ourServiceId'));

    CREATE INDEX kyberPreKeys_ourServiceId ON kyberPreKeys (ourServiceId);

    -- Finally, signed prekeys

    DROP INDEX signedPreKeys_ourServiceId;

    ALTER TABLE signedPreKeys
      DROP COLUMN ourServiceId;
    ALTER TABLE signedPreKeys
      ADD COLUMN ourServiceId NUMBER
      GENERATED ALWAYS AS (json_extract(json, '$.ourServiceId'));

    CREATE INDEX signedPreKeys_ourServiceId ON signedPreKeys (ourServiceId);
  `);let r=e.prepare(`SELECT count(*) FROM preKeys;`,{pluck:!0}).get()??0;if(n.info(`Found ${r} keys`),r<1e3)return;let a,o=e.prepare(`SELECT json FROM items WHERE id IS 'pni'`,{pluck:!0}).get();try{a=i.Mr(JSON.parse(o??``).value,`updateToSchemaVersion91`)}catch(e){o?n.warn(`PNI found but did not parse`,t._i(e)):n.info(`Our PNI not found`);return}let[s,c]=t.mt`SELECT count(*) from preKeys WHERE ourServiceId = ${a}`,l=e.prepare(s,{pluck:!0}).get(c);n.info(`Found ${l} preKeys for PNI`),e.exec(`
    ALTER TABLE preKeys
      ADD COLUMN createdAt NUMBER
        GENERATED ALWAYS AS (json_extract(json, '$.createdAt'));

    CREATE INDEX preKeys_date
      ON preKeys (ourServiceId, createdAt);
  `),n.info(`Temporary index created`);let[u,d]=t.mt`
    SELECT createdAt
    FROM preKeys
    WHERE
      createdAt IS NOT NULL AND
      ourServiceId = ${a}
    ORDER BY createdAt ASC
    LIMIT 1
    OFFSET 499
  `,f=e.prepare(u,{pluck:!0}).get(d);n.info(`Found 500th-oldest timestamp: ${f}`);let[p,m]=t.mt`
    SELECT createdAt
    FROM preKeys
    WHERE
      createdAt IS NOT NULL AND
      ourServiceId = ${a}
    ORDER BY createdAt DESC
    LIMIT 1
    OFFSET 499
  `,h=e.prepare(p,{pluck:!0}).get(m);n.info(`Found 500th-newest timestamp: ${h}`);let g,[_,v]=t.mt`
    DELETE FROM preKeys
    WHERE rowid IN (
      SELECT rowid FROM preKeys
      WHERE
        createdAt IS NOT NULL AND
        createdAt > ${f??null} AND
        createdAt < ${h??null} AND
        ourServiceId = ${a}
      LIMIT 10000
    );
  `,y=e.prepare(_);do g=y.run(v),n.info(`Deleted ${g.changes} items`);while(g.changes>0);n.info(`Delete is complete!`);let[b,x]=t.mt`
    SELECT count(*)
    FROM preKeys
    WHERE ourServiceId = ${a};
  `,S=e.prepare(b,{pluck:!0}).get(x);n.info(`Found ${S} preKeys for PNI after delete`),e.exec(`
    DROP INDEX preKeys_date;
    ALTER TABLE preKeys DROP COLUMN createdAt;
  `)}function ut(){}function dt(){}function ft(){}i.Or(),i.Hn();function pt(e,t){let n=mt(e,t);if(!n){t.info(`not running, pni is normalized`);return}e.prepare(`
      UPDATE conversations
      SET json = json_set(json, '$.pni', $pni)
      WHERE serviceId IS $aci
    `).run({aci:n.aci,pni:n.pni}),ht(e,`preKeys`,n,t),ht(e,`signedPreKeys`,n,t),ht(e,`kyberPreKeys`,n,t)}function mt(e,t){let n=e.prepare(`
    SELECT json
    FROM items
    WHERE id IS 'uuid_id'
  `,{pluck:!0}).get(),r=e.prepare(`
    SELECT json
    FROM items
    WHERE id IS 'pni'
  `,{pluck:!0}).get(),a;try{[a]=JSON.parse(n??``).value.split(`.`,2)}catch(e){n?t.warn(`failed to parse uuid_id item`,e):t.info(`Our ACI not found`)}if(!a)return;let o;try{o=JSON.parse(r??``).value}catch(e){r?t.warn(`failed to parse pni item`,e):t.info(`Our PNI not found`)}if(!o)return;let s=gt(o,`pni`,t);if(!s||s===o)return;let c=e.prepare(`
      SELECT id, json
      FROM items
      WHERE id IN ('identityKeyMap', 'registrationIdMap');
    `).all(),l=e.prepare(`UPDATE items SET json = $json WHERE id IS $id`);l.run({id:`pni`,json:JSON.stringify({id:`pni`,value:s})});for(let{id:e,json:n}of c)try{let t=JSON.parse(n),r=t.value[o];r&&(delete t.value[o],t.value[s]=r),l.run({id:e,json:JSON.stringify(t)})}catch(n){t.warn(`failed to parse ${e} item`,n)}return{aci:i.Un(a,`uuid_id`,t),pni:s,legacyPni:o}}function ht(e,t,{legacyPni:n,pni:r},i){let a=e.prepare(`SELECT id, json FROM ${t} WHERE ourServiceId IS $legacyPni`).all({legacyPni:n}),o=e.prepare(`
    UPDATE ${t}
    SET id = $newId, json = $newJson
    WHERE id = $id
  `);i.info(`updating ${a.length} ${t}`);for(let{id:e,json:s}of a){let a=e.match(/^(.*):(.*)$/);if(!a){i.warn(`invalid ${t} id ${e}`);continue}let c;try{c=JSON.parse(s)}catch(n){i.warn(`failed to parse ${t} ${e}`,n);continue}let[,l,u]=a;if(l!==n){i.warn(`unexpected ourServiceId`,l,n);continue}let d=`${r}:${u}`,f={...c,id:d,ourServiceId:r};o.run({id:e,newId:d,newJson:JSON.stringify(f)})}}function gt(e,t,n){if(e!=null)return e.toLowerCase().startsWith(`pni:`)?i.Mr(e,t,n):i.Mr(`PNI:${e}`,t,n)}function _t(e){e.exec(`
    INSERT INTO messages_fts(messages_fts) VALUES ('optimize');
  `)}function vt(e){e.exec(`
    ALTER TABLE reactions ADD COLUMN timestamp NUMBER;

    CREATE INDEX reactions_byTimestamp
    ON reactions
    (fromId, timestamp);
  `)}function yt(e){e.exec(`
    UPDATE conversations
    SET json = json_remove(
      json_insert(
        json,
        '$.sharingPhoneNumber',
        iif(
          json ->> '$.notSharingPhoneNumber',
          -- We flip the value from false to true, and vice versa
          json('false'),
          json('true')
        )
      ),
      '$.notSharingPhoneNumber'
    )
    -- Default value of '$.notSharingPhoneNumber' is true and
    -- the default value of '$.sharingPhoneNumber' is false so we don't have
    -- to do anything if the field wasn't present.
    WHERE json ->> '$.notSharingPhoneNumber' IS NOT NULL;
  `)}i.Q(),i.O(),t.qr(),t.ct();const bt=t.ht(i.Z.Unread),xt=t.ht(i.Z.Read),St=t.ht(i.D.Unseen);function Ct(e){let[n]=t.mt`
    SELECT id
    FROM messages
    WHERE messages.type = 'call-history'
      AND messages.readStatus IS ${bt}
  `,r=e.prepare(n).all();for(let n of r){let{id:r}=n;t.Yr(r!=null,`message id must exist`);let[a,o]=t.mt`
      UPDATE messages
      SET
        json = JSON_PATCH(json, ${JSON.stringify({readStatus:i.Z.Read,seenStatus:i.D.Unseen})}),
        readStatus = ${xt},
        seenStatus = ${St}
      WHERE id = ${r}
    `;e.prepare(a).run(o)}}t.ct();function wt(e){let[n]=t.mt`
    CREATE TABLE callLinks (
      roomId TEXT NOT NULL PRIMARY KEY,
      rootKey BLOB NOT NULL,
      adminKey BLOB,
      name TEXT NOT NULL,
      -- Enum which stores CallLinkRestrictions from ringrtc
      restrictions INTEGER NOT NULL,
      revoked INTEGER NOT NULL,
      expiration INTEGER
    ) STRICT;
  `;e.exec(n)}t.ct();function Tt(e,n){let r=v(e);if(r==null){n.info(`not linked`);return}let[i,a]=t.mt`
    SELECT id FROM conversations
    WHERE serviceId IS ${r}
  `,o=e.prepare(i,{pluck:!0}).get(a);if(o==null){n.error(`no conversation`);return}let[s,c]=t.mt`
    DELETE FROM messages
    WHERE
      conversationId IS ${o} AND
      type IS 'conversation-merge'
  `,{changes:l}=e.prepare(s).run(c);l!==0&&n.warn(`removed ${l} self merges`)}t.ct();function Et(e){let n=t.gt`
    type IS NULL
    OR
    type NOT IN (
      'change-number-notification',
      'contact-removed-notification',
      'conversation-merge',
      'group-v1-migration',
      'keychange',
      'message-history-unsynced',
      'profile-change',
      'story',
      'universal-timer-notification',
      'verified-change'
    )
    AND NOT (
      type IS 'message-request-response-event'
      AND json_extract(json, '$.messageRequestResponseEvent') IN ('ACCEPT', 'BLOCK', 'UNBLOCK')
    )
  `,[r]=t.mt`
    --- These will be re-added below
    DROP INDEX messages_preview;
    DROP INDEX messages_preview_without_story;
    DROP INDEX messages_activity;
    DROP INDEX message_user_initiated;

    --- These will also be re-added below
    ALTER TABLE messages DROP COLUMN shouldAffectActivity;
    ALTER TABLE messages DROP COLUMN shouldAffectPreview;

    --- (change: added message-request-response-event->ACCEPT/BLOCK/UNBLOCK)
    ALTER TABLE messages
      ADD COLUMN shouldAffectPreview INTEGER
      GENERATED ALWAYS AS (${n});
    ALTER TABLE messages
      ADD COLUMN shouldAffectActivity INTEGER
      GENERATED ALWAYS AS (${n});

    --- From migration 88
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at);

    --- From migration 88
    CREATE INDEX messages_preview_without_story ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at) WHERE storyId IS NULL;

    --- From migration 88
    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync,
       isGroupLeaveEventFromOther, received_at, sent_at);

    --- From migration 81
    CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);
  `;e.exec(r)}t.B(),t.ct(),t.J(),t.Xr(),t.nn(),t.bt();const Dt=t.Ri({attachment:t.Ri({size:t.Li(),contentType:t.Qt}).passthrough(),attachmentType:t.V,ciphertextSize:t.Li(),contentType:t.Qt,digest:t.Vi(),isManualDownload:t.ji().optional(),messageId:t.Vi(),messageIdForLogging:t.Vi().optional(),receivedAt:t.Li(),sentAt:t.Li(),size:t.Li(),source:t.Ii(t.H)}).and(t.xt);function Ot(e,n){let r=e.prepare(`
        SELECT id, timestamp, pending, json from attachment_downloads
      `).all();n.info(`loaded ${r.length} existing jobs`),e.exec(`
      CREATE TABLE tmp_attachment_downloads (
        messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        attachmentType TEXT NOT NULL,
        digest TEXT NOT NULL,
        receivedAt INTEGER NOT NULL,
        sentAt INTEGER NOT NULL,
        contentType TEXT NOT NULL,
        size INTEGER NOT NULL,
        attachmentJson TEXT NOT NULL,
        active INTEGER NOT NULL,
        attempts INTEGER NOT NULL,
        retryAfter INTEGER,
        lastAttemptTimestamp INTEGER,

        PRIMARY KEY (messageId, attachmentType, digest)
      ) STRICT;
  `),e.exec(`DROP TABLE attachment_downloads;`),e.exec(`ALTER TABLE tmp_attachment_downloads RENAME TO attachment_downloads;`),e.exec(`
    CREATE INDEX attachment_downloads_active_receivedAt
      ON attachment_downloads (
        active, receivedAt
    );
  `),e.exec(`
    CREATE INDEX attachment_downloads_active_messageId
      ON attachment_downloads (
        active, messageId
    );
  `),e.exec(`
    CREATE INDEX attachment_downloads_messageId
      ON attachment_downloads (
        messageId
    );
  `);let i=[];for(let e of r)try{let n=t.lt(e.json??``),r=t.Qr(Dt,{messageId:n.messageId,attachmentType:n.type,attachment:n.attachment,receivedAt:n.timestamp??Date.now(),sentAt:n.timestamp??Date.now(),digest:n.attachment?.digest,contentType:n.attachment?.contentType,size:n.attachment?.size,active:!1,attempts:n.attempts??0,retryAfter:null,lastAttemptTimestamp:null,source:t.H.STANDARD,ciphertextSize:0});i.push(r)}catch{n.warn(`unable to transfer job ${e.id} to new table; invalid data`)}let a=0;if(i.length){n.info(`transferring ${i.length} rows`);for(let r of i){let[i,o]=t.mt`
        INSERT INTO attachment_downloads
          (
            messageId,
            attachmentType,
            receivedAt,
            sentAt,
            digest,
            contentType,
            size,
            attachmentJson,
            active,
            attempts,
            retryAfter,
            lastAttemptTimestamp
          )
        VALUES
          (
            ${r.messageId},
            ${r.attachmentType},
            ${r.receivedAt},
            ${r.sentAt},
            ${r.digest},
            ${r.contentType},
            ${r.size},
            ${t.ut(r.attachment)},
            ${+!!r.active},
            ${r.attempts},
            ${r.retryAfter},
            ${r.lastAttemptTimestamp}
          );
      `;try{e.prepare(i).run(o),a+=1}catch(e){n.error(`error when transferring row`,e)}}}n.info(`transferred ${a} rows, removed ${r.length-a}`)}t.Nt(),t.ct();function kt(e){let[n]=t.mt`
    DROP TABLE IF EXISTS groupSendCombinedEndorsement;
    DROP TABLE IF EXISTS groupSendMemberEndorsement;

    -- From GroupSendEndorsementsResponse->ReceivedEndorsements in libsignal
    -- this is the combined endorsement for all group members
    CREATE TABLE groupSendCombinedEndorsement (
      groupId TEXT NOT NULL PRIMARY KEY, -- Only one endorsement per group
      expiration INTEGER NOT NULL, -- Unix timestamp in seconds
      endorsement BLOB NOT NULL
    ) STRICT;

    -- From GroupSendEndorsementsResponse->ReceivedEndorsements in libsignal
    -- these are the individual endorsements for each group member
    CREATE TABLE groupSendMemberEndorsement (
      groupId TEXT NOT NULL,
      memberAci TEXT NOT NULL,
      expiration INTEGER NOT NULL, -- Unix timestamp in seconds
      endorsement BLOB NOT NULL,
      PRIMARY KEY (groupId, memberAci) -- Only one endorsement per group member
    ) STRICT;
  `;e.exec(n)}function At(e){e.exec(`
    ALTER TABLE messages
      ADD COLUMN isAddressableMessage INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type IN (
          'incoming',
          'outgoing'
        )
      );

    CREATE INDEX messages_by_date_addressable
      ON messages (
        conversationId, isAddressableMessage, received_at, sent_at
    );

    CREATE TABLE syncTasks(
      id TEXT PRIMARY KEY NOT NULL,
      attempts INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      data TEXT NOT NULL,
      envelopeId TEXT NOT NULL,
      sentAt INTEGER NOT NULL,
      type TEXT NOT NULL
    ) STRICT;

    CREATE INDEX syncTasks_order ON syncTasks (
      createdAt, sentAt, id
    )
  `)}function jt(e){e.exec(`
    CREATE TABLE attachment_backup_jobs (
      mediaName TEXT NOT NULL PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      receivedAt INTEGER NOT NULL,

      -- job manager fields
      attempts INTEGER NOT NULL,
      active INTEGER NOT NULL,
      retryAfter INTEGER,
      lastAttemptTimestamp INTEGER
    ) STRICT;

    CREATE INDEX attachment_backup_jobs_receivedAt
      ON attachment_backup_jobs (
        receivedAt
    );

    CREATE INDEX attachment_backup_jobs_type_receivedAt
      ON attachment_backup_jobs (
        type, receivedAt
    );

    CREATE TABLE backup_cdn_object_metadata (
      mediaId TEXT NOT NULL PRIMARY KEY,
      cdnNumber INTEGER NOT NULL,
      sizeOnBackupCdn INTEGER
    ) STRICT;
  `)}function Mt(e){e.exec(`
    CREATE INDEX messages_by_date_addressable_nondisappearing
      ON messages (
        conversationId, isAddressableMessage, received_at, sent_at
    ) WHERE expireTimer IS NULL;
  `)}function Nt(e){e.exec(`
    CREATE INDEX reactions_messageId
      ON reactions (messageId);

    CREATE INDEX storyReads_storyId
      ON storyReads (storyId);
  `)}t.ct();function Pt(e){let[n]=t.mt`
    -- Fix: Query went from readStatus to seenStatus but index wasn't updated
    DROP INDEX IF EXISTS messages_callHistory_readStatus;
    DROP INDEX IF EXISTS messages_callHistory_seenStatus;
    CREATE INDEX messages_callHistory_seenStatus
      ON messages (type, seenStatus)
      WHERE type IS 'call-history';

    -- Update to index created in 89: add sent_at to make it covering, and where clause to make it smaller
    DROP INDEX IF EXISTS messages_call;
    CREATE INDEX messages_call ON messages
      (type, conversationId, callId, sent_at)
      WHERE type IS 'call-history';

    -- Update to index created in 89: add callId and peerId to make it covering
    DROP INDEX IF EXISTS callsHistory_order;
    CREATE INDEX callsHistory_order ON callsHistory
      (timestamp DESC, callId, peerId);

    -- Update to index created in 89: add timestamp for querying by order and callId to make it covering
    DROP INDEX IF EXISTS callsHistory_byConversation;
    DROP INDEX IF EXISTS callsHistory_byConversation_order;
    CREATE INDEX callsHistory_byConversation_order ON callsHistory (peerId, timestamp DESC, callId);

    -- Optimize markAllCallHistoryRead
    DROP INDEX IF EXISTS messages_callHistory_markReadBefore;
    CREATE INDEX messages_callHistory_markReadBefore
      ON messages (type, seenStatus, sent_at DESC)
      WHERE type IS 'call-history';

    -- Optimize markAllCallHistoryReadInConversation
    DROP INDEX IF EXISTS messages_callHistory_markReadByConversationBefore;
    CREATE INDEX messages_callHistory_markReadByConversationBefore
      ON messages (type, conversationId, seenStatus, sent_at DESC)
      WHERE type IS 'call-history';
  `;e.exec(n)}function Ft(e){e.exec(`
    ALTER TABLE stickers
      ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

    ALTER TABLE stickers
      ADD COLUMN localKey TEXT;

    ALTER TABLE stickers
      ADD COLUMN size INTEGER;
  `)}function It(e){e.exec(`
    CREATE INDEX edited_messages_messageId
      ON edited_messages(messageId);

    CREATE INDEX mentions_messageId
      ON mentions(messageId);
  `)}function Lt(e){e.exec(`
    CREATE INDEX messages_isStory
      ON messages(received_at, sent_at)
      WHERE isStory = 1;
  `)}function Rt(e){e.exec(`
    DROP INDEX IF EXISTS callLinks_deleted;

    ALTER TABLE callLinks
      ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX callLinks_deleted
      ON callLinks (deleted, roomId);
  `)}function zt(e){e.exec(`
    -- All future conversations will start from '1'
    ALTER TABLE conversations
      ADD COLUMN expireTimerVersion INTEGER NOT NULL DEFAULT 1;

    -- All current conversations will start from '2'
    UPDATE conversations SET expireTimerVersion = 2;
  `)}t.ct(),i.vt();const Bt=t.ht(i.at.Missed),Vt=t.ht(i.tt.Incoming);function Ht(e){let[n]=t.mt`
    DROP INDEX IF EXISTS callsHistory_incoming_missed;

    CREATE INDEX callsHistory_incoming_missed
      ON callsHistory (callId, status, direction)
      WHERE status IS ${Bt}
        AND direction IS ${Vt};
  `;e.exec(n)}t.ct();function Ut(e){let[n]=t.mt`
    DROP INDEX IF EXISTS messages_callHistory_markReadBefore;
    CREATE INDEX messages_callHistory_markReadBefore
      ON messages (type, seenStatus, received_at DESC)
      WHERE type IS 'call-history';
  `;e.exec(n)}t.J();function Wt(e){e.exec(`
    ALTER TABLE attachment_downloads
        ADD COLUMN source TEXT NOT NULL DEFAULT ${t.H.STANDARD};

    ALTER TABLE attachment_downloads
        -- this default value will be overridden by getNextAttachmentDownloadJobs
        ADD COLUMN ciphertextSize INTEGER NOT NULL DEFAULT 0;
  `),e.exec(`
    CREATE INDEX attachment_downloads_source_ciphertextSize
        ON attachment_downloads (
            source, ciphertextSize
        );
  `)}function Gt(e){e.exec(`
    ALTER TABLE callLinks ADD COLUMN storageID TEXT;
    ALTER TABLE callLinks ADD COLUMN storageVersion INTEGER;
    ALTER TABLE callLinks ADD COLUMN storageUnknownFields BLOB;
    ALTER TABLE callLinks ADD COLUMN storageNeedsSync INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE callLinks ADD COLUMN deletedAt INTEGER;
  `),e.prepare(`
    UPDATE callLinks
      SET deletedAt = $deletedAt
      WHERE deleted = 1;
    `).run({deletedAt:new Date().getTime()})}function Kt(e){e.exec(`
    CREATE INDEX attachment_downloads_active_source_receivedAt
        ON attachment_downloads (
            active, source, receivedAt
        );
  `)}function qt(e){e.exec(`
    ALTER TABLE callsHistory
      ADD COLUMN startedById TEXT DEFAULT NULL;

    ALTER TABLE callsHistory
      ADD COLUMN endedTimestamp INTEGER DEFAULT NULL;
  `)}t.Rn();const{get:Jt,isFinite:Yt,isInteger:Xt,isString:Zt}=m.default;function Qt(e){return st.signal.proto.storage.RecordStructure.encode(e)}function $t(e,t){let n=e.sessions||{},r=Object.values(n),i=r.find(e=>e?.indexInfo?.closed===-1),a;a=i?en(i,t):null,r.sort((e,t)=>(t?.indexInfo?.closed||0)-(e?.indexInfo?.closed||0));let o=r.filter(e=>e?.indexInfo?.closed!==-1);if(o.length<r.length-1)throw Error(`toProtobuf: More than one open session!`);let s=[];if(o.forEach(e=>{s.push(en(e,t))}),!a&&s.length===0)throw Error(`toProtobuf: Record had no sessions!`);return{currentSession:a,previousSessions:s}}function en(e,t){let n=e.currentRatchet?.ephemeralKeyPair?.pubKey;if(!n)throw Error(`toProtobufSession: No sender base key!`);let r=e[n];if(!r)throw Error(`toProtobufSession: No matching chain found with senderBaseKey!`);if(r.chainType!==1)throw Error(`toProtobufSession: Expected sender chain type for senderChain, got ${r.chainType}`);let i=tn(r);i.senderRatchetKey=O(e,`currentRatchet.ephemeralKeyPair.pubKey`,33),i.senderRatchetKeyPrivate=O(e,`currentRatchet.ephemeralKeyPair.privKey`,32);let a=e.currentRatchet?.lastRemoteEphemeralKey;if(!a)throw Error(`toProtobufSession: No receiver base key!`);let o=e[a],s=[];if(o){let t=tn(o);if(o.chainType!==2)throw Error(`toProtobufSession: Expected receiver chain type for firstReceiverChain, got ${o.chainType}`);t.senderRatchetKey=O(e,`currentRatchet.lastRemoteEphemeralKey`,33),s.push(t)}return(e.oldRatchetList||[]).slice(0).sort((e,t)=>(t.added||0)-(e.added||0)).forEach(t=>{let n=t.ephemeralKey;if(!n)throw Error(`toProtobufSession: No base key for old receiver chain!`);let r=e[n];if(!r)throw Error(`toProtobufSession: No chain for old receiver chain base key!`);if(r.chainType!==2)throw Error(`toProtobufSession: Expected receiver chain type, got ${r.chainType}`);let i=tn(r);i.senderRatchetKey=O(t,`ephemeralKey`,33),s.push(i)}),{aliceBaseKey:O(e,`indexInfo.baseKey`,33),localIdentityPublic:t.identityKeyPublic,localRegistrationId:t.registrationId,previousCounter:k(e,`currentRatchet.previousCounter`)+1,remoteIdentityPublic:O(e,`indexInfo.remoteIdentityKey`,33),remoteRegistrationId:k(e,`registrationId`),rootKey:O(e,`currentRatchet.rootKey`,32),sessionVersion:3,needsRefresh:null,pendingPreKey:e.pendingPreKey?{baseKey:O(e,`pendingPreKey.baseKey`,33),signedPreKeyId:k(e,`pendingPreKey.signedKeyId`),preKeyId:e.pendingPreKey.preKeyId===void 0?null:k(e,`pendingPreKey.preKeyId`)}:null,senderChain:i,receiverChains:s}}function tn(e){let t=Object.entries(e.messageKeys||{});return{chainKey:{index:k(e,`chainKey.counter`)+1,key:e.chainKey?.key===void 0?null:O(e,`chainKey.key`,32)},messageKeys:t.map(e=>{let{cipherKey:t,macKey:n,iv:r}=nn(O(e,`1`,32));return{index:k(e,`0`)+1,cipherKey:t,macKey:n,iv:r}}),senderRatchetKey:null,senderRatchetKeyPrivate:null}}function nn(e){let[n,r,i]=t.Cn(e,new Uint8Array(32),t.Nr(`WhisperMessageKeys`));return{cipherKey:n,macKey:r,iv:i.subarray(0,16)}}function O(e,n,r){let i=Jt(e,n);if(i==null)throw Error(`binaryToUint8Array: Falsey path ${n}`);if(!Zt(i))throw Error(`binaryToUint8Array: String not found at path ${n}`);let a=t.jr(i);if(r&&a.byteLength!==r)throw Error(`binaryToUint8Array: Got unexpected length ${a.byteLength} instead of ${r} at path ${n}`);return a}function k(e,t){let n=Jt(e,t);if(n==null)throw Error(`getInteger: Falsey path ${t}`);if(Zt(n)){let e=parseInt(n,10);if(!Yt(e))throw Error(`getInteger: Value could not be parsed as number at ${t}: {target}`);if(!Xt(e))throw Error(`getInteger: Parsed value not an integer at ${t}: {target}`);return e}if(!Xt(n))throw Error(`getInteger: Value not an integer at ${t}: {target}`);return n}t.bi(),t.hi(),n.f();const rn=t.xi.record(t.xi.string(),t.xi.object({privKey:t.xi.string().transform(e=>Buffer.from(e,`base64`)),pubKey:t.xi.string().transform(e=>Buffer.from(e,`base64`))})),an=t.xi.record(t.xi.string(),t.xi.number()),on=t.xi.object({id:t.xi.string(),ourServiceId:t.xi.string(),serviceId:t.xi.string(),conversationId:t.xi.string(),deviceId:t.xi.number(),record:t.xi.string(),version:t.xi.literal(1).or(t.xi.literal(2))});function sn(e,r,i,a){let{id:o,conversationId:s,ourServiceId:l,serviceId:u,json:d}=e,f=on.parse(JSON.parse(d));if(c.default.strictEqual(f.id,o,`Invalid id`),c.default.strictEqual(f.conversationId,s,`Invalid conversationId`),c.default.strictEqual(f.ourServiceId,l,`Invalid ourServiceId,`),c.default.strictEqual(f.serviceId,u,`Invalid serviceId`),f.version===2)return{id:o,conversationId:s,ourServiceId:l,serviceId:u,deviceId:f.deviceId,record:Buffer.from(f.record,`base64`)};if(f.version===1){let e=t.b(r,l);if(!e)throw Error(`migrateSession: No identity key for ourself!`);let n=t.b(i,l);if(n==null)throw Error(`_maybeMigrateSession: No registration id for ourself!`);let c={identityKeyPublic:e.pubKey,registrationId:n};a.info(`migrateSession: Migrating session with id ${o}`);let d=$t(JSON.parse(f.record),c);return{id:o,conversationId:s,ourServiceId:l,serviceId:u,deviceId:f.deviceId,record:Buffer.from(Qt(d))}}throw n.p(f.version)}function cn(e,n){e.exec(`
    ALTER TABLE sessions
      RENAME TO old_sessions;

    CREATE TABLE sessions (
      id TEXT NOT NULL PRIMARY KEY,
      ourServiceId TEXT NOT NULL,
      serviceId TEXT NOT NULL,
      conversationId TEXT NOT NULL,
      deviceId INTEGER NOT NULL,
      record BLOB NOT NULL
    ) STRICT;
  `);let r=e.prepare(`
    SELECT json -> '$.value' FROM items WHERE id IS ?
  `,{pluck:!0}),i=r.get([`identityKeyMap`]),a=r.get([`registrationIdMap`]);if(!i||!a){n.info(`no identity/registration id`),e.exec(`DROP TABLE old_sessions`);return}let o=rn.parse(JSON.parse(i)),s=an.parse(JSON.parse(a)),c=e.prepare(`DELETE FROM old_sessions RETURNING * LIMIT 1000`),l=e.prepare(`
    INSERT INTO sessions
    (id, ourServiceId, serviceId, conversationId, deviceId, record)
    VALUES
    ($id, $ourServiceId, $serviceId, $conversationId, $deviceId, $record)
  `),u=0,d=0;for(;;){let e=c.all();if(e.length===0)break;for(let r of e)try{l.run(sn(r,o,s,n)),u+=1}catch(e){d+=1,n.error(`failed to migrate session`,t._i(e))}}n.info(`migrated ${u} sessions, ${d} failed`),e.exec(`DROP TABLE old_sessions`)}function ln(e){e.exec(`
    DROP INDEX IF EXISTS callLinks_adminKey;

    CREATE INDEX callLinks_adminKey
      ON callLinks (adminKey);
  `)}t.ct();function un(e){let[n]=t.mt`
    CREATE TABLE defunctCallLinks (
      roomId TEXT NOT NULL PRIMARY KEY,
      rootKey BLOB NOT NULL,
      adminKey BLOB
    ) STRICT;
  `;e.exec(n)}function dn(e){e.exec(`
    ALTER TABLE defunctCallLinks ADD COLUMN storageID TEXT;
    ALTER TABLE defunctCallLinks ADD COLUMN storageVersion INTEGER;
    ALTER TABLE defunctCallLinks ADD COLUMN storageUnknownFields BLOB;
    ALTER TABLE defunctCallLinks ADD COLUMN storageNeedsSync INTEGER NOT NULL DEFAULT 0;
  `)}t.ct();function fn(e){let[n]=t.mt`
    DROP INDEX IF EXISTS syncTasks_order;
    CREATE INDEX syncTasks_delete ON syncTasks (attempts DESC);
  `;e.exec(n)}t.ct();function pn(e){let[n]=t.mt`
    ALTER TABLE messages
      ADD COLUMN timestamp INTEGER;
    ALTER TABLE messages
      ADD COLUMN received_at_ms INTEGER;
    ALTER TABLE messages
      ADD COLUMN unidentifiedDeliveryReceived INTEGER;
    ALTER TABLE messages
      ADD COLUMN serverTimestamp INTEGER;

    ALTER TABLE messages
      RENAME COLUMN source TO legacySource;
    ALTER TABLE messages
      ADD COLUMN source TEXT;

    UPDATE messages SET
      timestamp = json_extract(json, '$.timestamp'),
      received_at_ms = json_extract(json, '$.received_at_ms'),
      unidentifiedDeliveryReceived =
        json_extract(json, '$.unidentifiedDeliveryReceived'),
      serverTimestamp =
        json_extract(json, '$.serverTimestamp'),
      source = IFNULL(json_extract(json, '$.source'), '+' || legacySource);

    ALTER TABLE messages
      DROP COLUMN legacySource;
  `;e.exec(n)}t.g(),i.Or(),i.p(),t.ct(),t.qr();function mn(e,n){let r=v(e),a=e.prepare(`SELECT * FROM unprocessed`).all(),[o]=t.mt`
    DROP TABLE unprocessed;

    CREATE TABLE unprocessed(
      id TEXT NOT NULL PRIMARY KEY ASC,
      type INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      receivedAtCounter INTEGER NOT NULL,
      urgent INTEGER NOT NULL,
      story INTEGER NOT NULL,
      serverGuid TEXT NOT NULL,
      serverTimestamp INTEGER NOT NULL,
      isEncrypted INTEGER NOT NULL,
      content BLOB NOT NULL,
      messageAgeSec INTEGER NOT NULL,
      destinationServiceId TEXT NOT NULL,

      -- Not present for 1:1 messages and not sealed messages
      groupId TEXT,

      -- Not present for sealed envelopes
      reportingToken BLOB,
      source TEXT,
      sourceServiceId TEXT,
      sourceDevice TEXT,

      -- Present only for PNP change number
      updatedPni TEXT
    ) STRICT;

    CREATE INDEX unprocessed_timestamp ON unprocessed
      (timestamp);

    CREATE INDEX unprocessed_byReceivedAtCounter ON unprocessed
      (receivedAtCounter);
  `;e.exec(o);let s=e.prepare(`
    INSERT INTO unprocessed
      (id, type, timestamp, attempts, receivedAtCounter, urgent, story,
       serverGuid, serverTimestamp, isEncrypted, content, source,
       messageAgeSec, sourceServiceId, sourceDevice,
       destinationServiceId, reportingToken)
    VALUES
      ($id, $type, $timestamp, $attempts, $receivedAtCounter, $urgent, $story,
       $serverGuid, $serverTimestamp, $isEncrypted, $content, $source,
       $messageAgeSec, $sourceServiceId, $sourceDevice,
       $destinationServiceId, $reportingToken);
  `),c=0;r||a.length&&(n.warn(`no aci, dropping ${a.length} envelopes`),a=[]);for(let e of a){let{id:a,envelope:o,decrypted:l,timestamp:u,attempts:d,version:f,receivedAtCounter:p,urgent:m,story:h,serverGuid:g,serverTimestamp:_,...v}=e;if(f!==2||!o){c+=1;continue}try{let e=t.o.migrations.Envelope.decode(Buffer.from(String(o),`base64`));if(!e.content)throw Error(`Missing envelope content`);let n=l?Buffer.from(String(l),`base64`):e.content;t.Yr(a!=null,`Missing id`),s.run({...v,id:a,type:i.m(t.o.migrations.Envelope.Type,e.type)?e.type:t.o.migrations.Envelope.Type.UNKNOWN,content:n??null,isEncrypted:+!l,timestamp:u||Date.now(),attempts:d||0,receivedAtCounter:p||0,urgent:+!!m,story:+!!h,serverGuid:g||t._(),serverTimestamp:_||0,destinationServiceId:i.Nr(e.destinationServiceId||r,`Envelope.destinationServiceId`)??null,updatedPni:i.jr(e.updatedPni)?i.Mr(i.Fr(e.updatedPni),`Envelope.updatedPni`):null,messageAgeSec:0,reportingToken:e.reportSpamToken?.length?e.reportSpamToken:null})}catch(e){n.warn(`failed to migrate unprocessed`,a,e)}}c!==0&&n.warn(`dropped ${c} envelopes`)}t.ct();function hn(e){let[n]=t.mt`
    ALTER TABLE unprocessed RENAME COLUMN sourceDevice TO legacySourceDevice;
    ALTER TABLE unprocessed ADD COLUMN sourceDevice INTEGER;

    UPDATE unprocessed
    SET sourceDevice = legacySourceDevice;

    ALTER TABLE unprocessed DROP COLUMN legacySourceDevice;
  `;e.exec(n)}t.ct();function gn(e){let[n]=t.mt`
    ALTER TABLE sticker_references
      ADD COLUMN stickerId INTEGER NOT NULL DEFAULT -1;
    ALTER TABLE sticker_references
      ADD COLUMN isUnresolved INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX unresolved_sticker_refs
    ON sticker_references (packId, stickerId)
    WHERE isUnresolved IS 1;
  `;e.exec(n)}t.ct();function _n(e,n){let[r,i]=t.mt`
    UPDATE conversations
      SET json = json_replace(
        json,
        '$.muteExpiresAt',
        9007199254740991 -- max safe integer
      )
      WHERE json ->> '$.muteExpiresAt' IS ${864e13};
  `,{changes:a}=e.prepare(r).run(i);a!==0&&n.warn(`fixed ${a} conversations`)}t.ct();function vn(e){let[n]=t.mt`
    DROP INDEX unprocessed_timestamp;

    ALTER TABLE unprocessed
      ADD COLUMN receivedAtDate INTEGER DEFAULT 0 NOT NULL;

    UPDATE unprocessed
      SET receivedAtDate = timestamp;

    CREATE INDEX unprocessed_byReceivedAtDate ON unprocessed
      (receivedAtDate);
  `;e.exec(n)}t.ct();function yn(e){let[n]=t.mt`
    CREATE INDEX syncTasks_type ON syncTasks (type);
  `;e.exec(n)}t.ct();function bn(e){let[n]=t.mt`
    CREATE TABLE recentGifs (
      id TEXT NOT NULL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      previewMedia_url TEXT NOT NULL,
      previewMedia_width INTEGER NOT NULL,
      previewMedia_height INTEGER NOT NULL,
      attachmentMedia_url TEXT NOT NULL,
      attachmentMedia_width INTEGER NOT NULL,
      attachmentMedia_height INTEGER NOT NULL,
      lastUsedAt INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX recentGifs_order ON recentGifs (
      lastUsedAt DESC
    );
  `;e.exec(n)}t.ct();function xn(e){let[n]=t.mt`
    CREATE TABLE notificationProfiles(
      id TEXT PRIMARY KEY NOT NULL,

      name TEXT NOT NULL,
      emoji TEXT,
      /* A numeric representation of a color, like 0xAARRGGBB */
      color INTEGER NOT NULL,

      createdAtMs INTEGER NOT NULL,

      allowAllCalls INTEGER NOT NULL,
      allowAllMentions INTEGER NOT NULL,

      /* A JSON array of conversationId strings */
      allowedMembersJson TEXT NOT NULL,
      scheduleEnabled INTEGER NOT NULL,

      /* 24-hour clock int, 0000-2359 (e.g., 15, 900, 1130, 2345) */
      scheduleStartTime INTEGER,
      scheduleEndTime INTEGER,

      /* A JSON object with true/false for each of the numbers in the Protobuf enum */
      scheduleDaysEnabledJson TEXT,
      deletedAtTimestampMs INTEGER,

      storageID TEXT,
      storageVersion INTEGER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL DEFAULT 0
    ) STRICT;
  `;e.exec(n)}function Sn(e){e.exec(`
    DROP TABLE IF EXISTS message_attachments;
  `),e.exec(`
    CREATE TABLE message_attachments (
      messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      -- For editHistoryIndex to be part of the primary key, it cannot be NULL in strict tables.
      -- For that reason, we use a value of -1 to indicate that it is the root message (not in editHistory)
      editHistoryIndex INTEGER NOT NULL,
      attachmentType TEXT NOT NULL, -- 'long-message' | 'quote' | 'attachment' | 'preview' | 'contact' | 'sticker'
      orderInMessage INTEGER NOT NULL,
      conversationId TEXT NOT NULL,
      sentAt INTEGER NOT NULL,
      clientUuid TEXT,
      size INTEGER NOT NULL,
      contentType TEXT NOT NULL,
      path TEXT,
      plaintextHash TEXT,
      localKey TEXT,
      caption TEXT,
      fileName TEXT,
      blurHash TEXT,
      height INTEGER,
      width INTEGER,
      digest TEXT,
      key TEXT,
      iv TEXT,
      downloadPath TEXT,
      version INTEGER,
      incrementalMac TEXT,
      incrementalMacChunkSize INTEGER,
      transitCdnKey TEXT,
      transitCdnNumber INTEGER,
      transitCdnUploadTimestamp INTEGER,
      backupMediaName TEXT,
      backupCdnNumber INTEGER,
      isReencryptableToSameDigest INTEGER,
      reencryptionIv TEXT,
      reencryptionKey TEXT,
      reencryptionDigest TEXT,
      thumbnailPath TEXT,
      thumbnailSize INTEGER,
      thumbnailContentType TEXT,
      thumbnailLocalKey TEXT,
      thumbnailVersion INTEGER,
      screenshotPath TEXT,
      screenshotSize INTEGER,
      screenshotContentType TEXT,
      screenshotLocalKey TEXT,
      screenshotVersion INTEGER,
      backupThumbnailPath TEXT,
      backupThumbnailSize INTEGER,
      backupThumbnailContentType TEXT,
      backupThumbnailLocalKey TEXT,
      backupThumbnailVersion INTEGER,
      storyTextAttachmentJson TEXT,
      localBackupPath TEXT,
      flags INTEGER,
      error INTEGER,
      wasTooBig INTEGER,
      isCorrupted INTEGER,
      copiedFromQuotedAttachment INTEGER,
      pending INTEGER,
      backfillError INTEGER,
      PRIMARY KEY (messageId, editHistoryIndex, attachmentType, orderInMessage)
    ) STRICT;
  `)}function Cn(e){e.exec(`
    DROP INDEX IF EXISTS message_attachments_messageId;
    DROP INDEX IF EXISTS message_attachments_plaintextHash;
    DROP INDEX IF EXISTS message_attachments_path;
    DROP INDEX IF EXISTS message_attachments_all_thumbnailPath;
    DROP INDEX IF EXISTS message_attachments_all_screenshotPath;
    DROP INDEX IF EXISTS message_attachments_all_backupThumbnailPath;
  `)}function wn(e){e.exec(`
    CREATE TABLE donationReceipts(
      id TEXT NOT NULL PRIMARY KEY,
      currencyType TEXT NOT NULL,
      paymentAmount INTEGER NOT NULL,
      paymentDetailJson TEXT NOT NULL,
      paymentType TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX donationReceipts_byTimestamp on donationReceipts(timestamp);
  `)}function Tn(e){e.exec(`
      ALTER TABLE attachment_downloads
          RENAME COLUMN digest TO attachmentSignature;
  `),e.exec(`
    ALTER TABLE message_attachments
      DROP COLUMN iv;
    ALTER TABLE message_attachments
      DROP COLUMN isReencryptableToSameDigest;
    ALTER TABLE message_attachments
      DROP COLUMN reencryptionIv;
    ALTER TABLE message_attachments
      DROP COLUMN reencryptionKey;
    ALTER TABLE message_attachments
      DROP COLUMN reencryptionDigest;
    ALTER TABLE message_attachments
      DROP COLUMN backupMediaName;
  `),e.exec(`
    UPDATE message_attachments
      SET backupCdnNumber = NULL;
  `)}function En(e){e.exec(`
    ALTER TABLE donationReceipts DROP COLUMN paymentDetailJson;
    ALTER TABLE donationReceipts DROP COLUMN paymentType;
  `)}function Dn(e){e.exec(`
    UPDATE conversations
      SET json = json_remove(json,
        '$.wallpaperPreset',
        '$.wallpaperPhotoPointerBase64',
        '$.dimWallpaperInDarkMode',
        '$.autoBubbleColor'
      );

    DELETE FROM items
      WHERE id IN (
        'defaultWallpaperPhotoPointer',
        'defaultWallpaperPreset',
        'defaultDimWallpaperInDarkMode',
        'defaultAutoBubbleColor'
      );
  `)}t.J();function On(e){e.exec(`
    ALTER TABLE attachment_downloads
      ADD COLUMN originalSource TEXT NOT NULL DEFAULT ${t.H.STANDARD};

    UPDATE attachment_downloads
      SET originalSource = source;
  `),e.exec(`
    CREATE TABLE attachment_downloads_backup_stats (
      id INTEGER PRIMARY KEY CHECK (id = 0),
      totalBytes INTEGER NOT NULL,
      completedBytes INTEGER NOT NULL
    ) STRICT;

    INSERT INTO attachment_downloads_backup_stats
      (id, totalBytes, completedBytes)
      VALUES
      (0, 0, 0);

    CREATE TRIGGER attachment_downloads_backup_job_insert
      AFTER INSERT ON attachment_downloads
      WHEN NEW.originalSource = 'backup_import'
      BEGIN
        UPDATE attachment_downloads_backup_stats SET
          totalBytes = totalBytes + NEW.ciphertextSize;
      END;

    CREATE TRIGGER attachment_downloads_backup_job_update
      AFTER UPDATE OF ciphertextSize ON attachment_downloads
      WHEN NEW.originalSource = 'backup_import'
      BEGIN
        UPDATE attachment_downloads_backup_stats SET
          totalBytes = MAX(0, totalBytes - OLD.ciphertextSize + NEW.ciphertextSize)
        WHERE id = 0;
      END;

    CREATE TRIGGER attachment_downloads_backup_job_delete
      AFTER DELETE ON attachment_downloads
      WHEN OLD.originalSource = 'backup_import'
      BEGIN
        UPDATE attachment_downloads_backup_stats SET
          completedBytes = completedBytes + OLD.ciphertextSize
        WHERE id = 0;
      END;
  `)}function kn(e){e.exec(`
    ALTER TABLE callLinks
      ADD COLUMN epoch BLOB;
  `),e.exec(`
    ALTER TABLE defunctCallLinks
      ADD COLUMN epoch BLOB;
  `)}t.ct();function An(e){let[n]=t.mt`
    CREATE TABLE chatFolders (
      id TEXT NOT NULL PRIMARY KEY,
      folderType INTEGER NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      showOnlyUnread INTEGER NOT NULL,
      showMutedChats INTEGER NOT NULL,
      includeAllIndividualChats INTEGER NOT NULL,
      includeAllGroupChats INTEGER NOT NULL,
      includedConversationIds TEXT NOT NULL,
      excludedConversationIds TEXT NOT NULL,
      deletedAtTimestampMs INTEGER NOT NULL,
      storageID TEXT,
      storageVersion INTEGER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX chatFolders_by_position on chatFolders (position);
  `;e.exec(n)}function jn(e){e.exec(`
    ALTER TABLE message_attachments
      ADD COLUMN messageType TEXT;
    ALTER TABLE message_attachments
      ADD COLUMN receivedAt INTEGER;
    ALTER TABLE message_attachments
      ADD COLUMN receivedAtMs INTEGER;
    ALTER TABLE message_attachments
      ADD COLUMN isViewOnce INTEGER;
  `),e.exec(`
    UPDATE message_attachments
    SET
      messageType = messages.type,
      receivedAt = messages.received_at,
      receivedAtMs = messages.received_at_ms,
      isViewOnce = messages.isViewOnce
    FROM (
      SELECT id, type, received_at, received_at_ms, isViewOnce
      FROM messages
    ) AS messages
    WHERE
      message_attachments.messageId IS messages.id
  `),e.exec(`
    CREATE INDEX message_attachments_getOlderMedia ON message_attachments
    (conversationId, attachmentType, receivedAt DESC, sentAt DESC)
    WHERE
      editHistoryIndex IS -1 AND
      messageType IN ('incoming', 'outgoing') AND
      isViewOnce IS NOT 1
  `)}function Mn(e){e.exec(`
    ALTER TABLE message_attachments
      ADD COLUMN duration REAL;
  `)}function Nn(e){e.exec(`
    CREATE TABLE kyberPreKey_triples (
      id TEXT NOT NULL REFERENCES kyberPreKeys(id) ON DELETE CASCADE,
      signedPreKeyId INTEGER NOT NULL,
      baseKey BLOB NOT NULL,
      UNIQUE(id, signedPreKeyId, baseKey) ON CONFLICT FAIL
    ) STRICT;
  `)}t.ct();function Pn(e,n){let[r,i]=t.mt`
    DELETE FROM chatFolders
    WHERE folderType IS 1
    AND id NOT IN (
      SELECT id FROM chatFolders
      WHERE folderType IS 1
      ORDER BY storageVersion DESC
      LIMIT 1
    )
  `,a=e.prepare(r).run(i);n.info(`Removed ${a.changes} duplicate all chats chat folders`)}t.ct();function Fn(e,n){let[r,i]=t.mt`
    DELETE FROM notificationProfiles
    WHERE id != lower(id);
  `,a=e.prepare(r).run(i);n.info(`Removed ${a.changes} notification profiles with non-lowercase ids`)}t.ct();const In=t.mt`
  CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isSearchable IS 1
    BEGIN
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.searchableText);
    END;
`[0],Ln=t.mt`
  CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN
      new.isSearchable IS 1 AND old.searchableText IS NOT new.searchableText
    BEGIN
      UPDATE messages_fts SET body = new.searchableText WHERE rowId = new.rowId;
    END;
`[0];function Rn(e){e.exec(`ALTER TABLE messages ADD COLUMN isSearchable INT 
      GENERATED ALWAYS AS (isViewOnce IS NOT 1 AND storyId IS NULL) VIRTUAL;`),e.exec(`
    ALTER TABLE messages ADD COLUMN searchableText TEXT GENERATED ALWAYS AS (
      CASE
        WHEN json->'poll' IS NOT NULL THEN json->'poll'->>'question'
        ELSE body
      END
      ) VIRTUAL;
  `),e.exec(`DROP TRIGGER IF EXISTS messages_on_insert;`),e.exec(In),e.exec(`DROP TRIGGER IF EXISTS messages_on_update;`),e.exec(Ln)}t.ct();function zn(e,n){let[r,i]=t.mt`
    UPDATE chatFolders
    SET
      includeAllIndividualChats = 1,
      includeAllGroupChats = 1,
      storageNeedsSync = 1
    WHERE
      folderType = ${1}
      AND (
        includeAllIndividualChats IS 0
        OR
        includeAllGroupChats IS 0
      )
  `,a=e.prepare(r).run(i);n.info(`Updated ${a.changes} all chats chat folders`)}function Bn(e){e.exec(`
    -- Add hasUnreadPollVotes column to messages table
    ALTER TABLE messages ADD COLUMN hasUnreadPollVotes INTEGER NOT NULL DEFAULT 0;

    -- Create partial index for efficient queries
    -- Only indexes rows where hasUnreadPollVotes = 1
    CREATE INDEX messages_unread_poll_votes ON messages (
      conversationId,
      received_at
    ) WHERE hasUnreadPollVotes = 1 AND type IS 'outgoing';
  `)}function Vn(e){e.exec(`
    ALTER TABLE messages ADD COLUMN hasExpireTimer INTEGER NOT NULL
    GENERATED ALWAYS AS (COALESCE(expireTimer, 0) > 0) VIRTUAL;     
  `)}function Hn(e){e.exec(`DROP INDEX IF EXISTS messages_conversationId_hasExpireTimer_expirationStartTimestamp;`),e.exec(`
    CREATE INDEX messages_conversationId_expirationStartTimestamp
    ON messages (conversationId, expirationStartTimestamp)
    WHERE hasExpireTimer IS 1;
  `)}function Un(e){e.exec(`
    ALTER TABLE messages
      ADD COLUMN hasPreviews INTEGER NOT NULL
      GENERATED ALWAYS AS (
        IFNULL(json_array_length(json, '$.preview'), 0) > 0
      );

    CREATE INDEX messages_hasPreviews
      ON messages (conversationId, received_at DESC, sent_at DESC)
      WHERE
        hasPreviews IS 1 AND
        isViewOnce IS NOT 1 AND
        type IN ('incoming', 'outgoing');
  `)}t.ct();function Wn(e){let[n]=t.mt`
    CREATE TABLE pinnedMessages (
     	id               INTEGER PRIMARY KEY AUTOINCREMENT,
     	conversationId   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     	messageId        TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
     	messageSentAt    INTEGER NOT NULL,
     	messageSenderAci TEXT NOT NULL,
     	pinnedByAci      TEXT NOT NULL,
     	pinnedAt         INTEGER NOT NULL,
     	expiresAt        INTEGER,
     	UNIQUE (conversationId, messageId)
    ) STRICT;

    CREATE INDEX pinnedMessages_byConversation
      ON pinnedMessages(
        conversationId,
        pinnedAt DESC,
        messageId
      );

    CREATE INDEX pinnedMessages_byExpiresAt
      ON pinnedMessages(
        expiresAt ASC
      )
      WHERE expiresAt IS NOT NULL;
  `;e.exec(n)}t.ct();function Gn(e,n){let[r,i]=t.mt`
    UPDATE messages 
      SET 
        json = json_remove(json, '$.poll'),
        hasUnreadPollVotes = 0
      WHERE isErased = 1 AND (
        json->'poll' IS NOT NULL OR
        hasUnreadPollVotes IS NOT 0
      )
  `,a=e.prepare(r).run(i);n.info(`Updated ${a.changes} poll messages`)}t.ct();function Kn(e){let[n]=t.mt`
    -- We only need the 'messageId' column
    ALTER TABLE pinnedMessages DROP COLUMN messageSentAt;
    ALTER TABLE pinnedMessages DROP COLUMN messageSenderAci;

    -- We dont need to know who pinned the message
    ALTER TABLE pinnedMessages DROP COLUMN pinnedByAci;
  `;e.exec(n)}t.ct();function qn(e,n){let[r]=t.mt`
      DELETE FROM messages 
      WHERE id IN (
        SELECT messages.id from messages
        INNER JOIN conversations ON messages.conversationId = conversations.id 
        WHERE 
          conversations.type = 'group'
          AND messages.storyId IS NOT NULL  
          AND NOT EXISTS (
            SELECT 1 FROM messages AS messages_exists
            WHERE messages.storyId = messages_exists.id AND messages_exists.isErased IS NOT 1
          )
      )
  `,i=e.prepare(r).run();i.changes>0&&n.warn(`Deleted ${i.changes} group story replies without matching stories`)}t.ct();function Jn(e){let[n]=t.mt`
    CREATE TABLE megaphones (
      id TEXT NOT NULL PRIMARY KEY,
      desktopMinVersion TEXT,
      priority INTEGER NOT NULL,
      dontShowBeforeEpochMs INTEGER NOT NULL,
      dontShowAfterEpochMs INTEGER NOT NULL,
      showForNumberOfDays INTEGER NOT NULL,
      primaryCtaId TEXT,
      secondaryCtaId TEXT,
      primaryCtaDataJson TEXT,
      secondaryCtaDataJson TEXT,
      conditionalId TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      primaryCtaText TEXT,
      secondaryCtaText TEXT,
      imagePath TEXT,
      localeFetched TEXT NOT NULL,
      shownAt INTEGER,
      snoozedAt INTEGER,
      snoozeCount INTEGER NOT NULL,
      isFinished INTEGER NOT NULL
    ) STRICT;
  `;e.exec(n)}t.ct();function Yn(e,n){let[r,i]=t.mt`
    WITH rowsKeepingUsername AS (
      SELECT
        rowId,
        json ->> '$.username' AS username,
        MAX(active_at)
      FROM conversations
      WHERE username IS NOT NULL
      GROUP BY username
    )
    UPDATE conversations AS c
    SET json = json_patch(json, ${JSON.stringify({username:null,needsStorageServiceSync:!0})})
    WHERE json ->> '$.username' IS NOT NULL
      AND c.rowId NOT IN (
        SELECT rowId from rowsKeepingUsername
      );
  `,a=e.prepare(r).run(i);a.changes>0&&n.warn(`Removed duplicate usernames from ${a.changes} conversations`)}function Xn(e){e.exec(`
    ALTER TABLE messages
      ADD COLUMN hasContacts INTEGER NOT NULL
      GENERATED ALWAYS AS (
        IFNULL(json_array_length(json, '$.contact'), 0) > 0
      );

    CREATE INDEX messages_hasContacts
      ON messages (conversationId, received_at DESC, sent_at DESC)
      WHERE
        hasContacts IS 1 AND
        isViewOnce IS NOT 1 AND
        type IN ('incoming', 'outgoing');
  `)}function Zn(e){e.exec(`
    CREATE INDEX message_attachments_sortBiggerMedia ON message_attachments
    (conversationId, attachmentType, size DESC, receivedAt DESC, sentAt DESC)
    WHERE
      editHistoryIndex IS -1 AND
      messageType IN ('incoming', 'outgoing') AND
      isViewOnce IS NOT 1;
  `)}i.Rr(),t.ct();function Qn(e){let[n,r]=t.mt`
    SELECT
      pin.id AS pinMessageId,
      target.sourceServiceId AS targetAuthorAci,
      target.sent_at AS targetSentTimestamp
    FROM messages AS pin
    LEFT JOIN messages AS target
      ON pin.json ->> '$.pinnedMessageId' = target.id
    WHERE pin.type IS 'pinned-message-notification'
  `;return e.prepare(n).all(r)}function $n(e){return e.targetSentTimestamp==null?`target message not found`:e.targetAuthorAci==null?`target message missing sourceServiceId`:i.zr(e.targetAuthorAci)?null:`target message sourceServiceId is not aci`}function er(e,n){let[r,i]=t.mt`
    UPDATE messages
    SET json = json_patch(json, ${JSON.stringify({pinnedMessageId:null,pinMessage:{targetAuthorAci:n.targetAuthorAci,targetSentTimestamp:n.targetSentTimestamp}})})
    WHERE id = ${n.pinMessageId};
  `;e.prepare(r).run(i)}function tr(e,n){let[r,i]=t.mt`
    DELETE FROM messages
    WHERE id = ${n.pinMessageId};
  `;e.prepare(r).run(i)}function nr(e,t){for(let n of Qn(e)){let r=$n(n);r==null?er(e,n):(tr(e,n),t.warn(`Dropped pin message ${n.pinMessageId} (reason: ${r})`))}}function rr(e){e.exec(`
    CREATE TABLE key_transparency_account_data (
      aci TEXT NOT NULL PRIMARY KEY,
      data BLOB NOT NULL
    ) STRICT;
  `)}function ir(e){e.exec(`
      CREATE TABLE attachments_protected_from_deletion (
        path TEXT NOT NULL,
        UNIQUE (path)
      ) STRICT;
    `),e.exec(`
    CREATE INDEX message_attachments_plaintextHash ON message_attachments (plaintextHash);
  `),e.exec(`
    CREATE INDEX message_attachments_path ON message_attachments (path);
  `),e.exec(`
    CREATE INDEX message_attachments_thumbnailPath ON message_attachments (thumbnailPath);
  `),e.exec(`
    CREATE INDEX message_attachments_screenshotPath ON message_attachments (screenshotPath);
  `),e.exec(`
    CREATE INDEX message_attachments_backupThumbnailPath ON message_attachments (backupThumbnailPath);
  `),e.exec(`
    CREATE TRIGGER stop_protecting_attachments_after_update 
    AFTER UPDATE OF path, thumbnailPath, screenshotPath, backupThumbnailPath 
    ON message_attachments
    WHEN 
      OLD.path IS NOT NEW.path OR
      OLD.thumbnailPath IS NOT NEW.thumbnailPath OR
      OLD.screenshotPath IS NOT NEW.screenshotPath OR
      OLD.backupThumbnailPath IS NOT NEW.backupThumbnailPath
    BEGIN
      DELETE FROM attachments_protected_from_deletion 
      WHERE path IN (NEW.path, NEW.thumbnailPath, NEW.screenshotPath, NEW.backupThumbnailPath);
    END;
  `),e.exec(`
    CREATE TRIGGER stop_protecting_attachments_after_insert 
    AFTER INSERT 
    ON message_attachments
    BEGIN
      DELETE FROM attachments_protected_from_deletion 
      WHERE path IN (NEW.path, NEW.thumbnailPath, NEW.screenshotPath, NEW.backupThumbnailPath);
    END;
  `)}function ar(e){e.exec(`
    DROP TABLE attachments_protected_from_deletion;
    
    CREATE TABLE attachments_protected_from_deletion (
      path TEXT NOT NULL,
      messageId TEXT NOT NULL,
      PRIMARY KEY (path, messageId)
    ) STRICT;
  `),e.exec(`
    DROP TRIGGER stop_protecting_attachments_after_update;
    
    CREATE TRIGGER stop_protecting_attachments_after_update 
    AFTER UPDATE OF path, thumbnailPath, screenshotPath, backupThumbnailPath 
    ON message_attachments
    WHEN 
      OLD.path IS NOT NEW.path OR
      OLD.thumbnailPath IS NOT NEW.thumbnailPath OR
      OLD.screenshotPath IS NOT NEW.screenshotPath OR
      OLD.backupThumbnailPath IS NOT NEW.backupThumbnailPath
    BEGIN
      DELETE FROM attachments_protected_from_deletion 
      WHERE 
        messageId IS NEW.messageId 
        AND path IN (
          NEW.path, 
          NEW.thumbnailPath, 
          NEW.screenshotPath, 
          NEW.backupThumbnailPath
        );
    END;
  `),e.exec(`
    DROP TRIGGER stop_protecting_attachments_after_insert;

    CREATE TRIGGER stop_protecting_attachments_after_insert 
    AFTER INSERT 
    ON message_attachments
    BEGIN
      DELETE FROM attachments_protected_from_deletion 
      WHERE 
        messageId IS NEW.messageId 
        AND path IN (
          NEW.path, 
          NEW.thumbnailPath, 
          NEW.screenshotPath, 
          NEW.backupThumbnailPath
        );
    END;
  `)}t.ct();function or(e){let[n]=t.mt`
    ALTER TABLE callLinks DROP COLUMN epoch;
    ALTER TABLE defunctCallLinks DROP COLUMN epoch;
  `;e.exec(n)}t.bi(),t.Xr();const A=t.xi.string().or(t.xi.null()).optional().transform(e=>e||void 0),sr=t.xi.object({e164:A,name:A,profileName:A,profileFamilyName:A,systemGivenName:A,systemFamilyName:A,systemNickname:A,nicknameGivenName:A,nicknameFamilyName:A,username:A}).passthrough();function cr(e,n){let r=e.prepare(`SELECT * FROM conversations`).all(),i=e.prepare(`
    UPDATE conversations
    SET
      json = $json,
      e164 = $e164,
      name = $name,
      profileName = $profileName,
      profileFamilyName = $profileFamilyName
    WHERE
      id is $id
  `),a=0;for(let e of r){let r=t.ii(sr,JSON.parse(e.json));if(!r.success){n.warn(`failed to parse conversation json ${e.id}`,r.error);continue}let o=JSON.stringify(r.data),s=e.e164||null,c=e.name||null,l=e.profileName||null,u=e.profileFamilyName||null;o===e.json&&s===e.e164&&c===e.name&&l===e.profileName&&u===e.profileFamilyName||(a+=1,i.run({id:e.id,json:o,e164:s,name:c,profileName:l,profileFamilyName:u}))}a!==0&&n.warn(`fixed ${a} conversations`)}t.ct();function lr(e,n){let[r,i]=t.mt`
    UPDATE messages AS message
      SET json = json_remove(
        json_set(
          message.json,
          '$.pollTerminateNotification.pollTimestamp',
          COALESCE(
            (
              SELECT poll.timestamp
              FROM messages AS poll
              WHERE poll.id = message.json ->> '$.pollTerminateNotification.pollMessageId'
            ),
            0
          )
        ),
        '$.pollTerminateNotification.pollMessageId'
      )
      WHERE
        message.type IS 'poll-terminate' AND
        message.json -> '$.pollTerminateNotification' IS NOT NULL;
  `,a=e.prepare(r).run(i);n.info(`Updated ${a.changes} poll terminate notifications`)}t.bi(),t.Xr();function ur(e){return e?.trim()||void 0}const dr=t.xi.string().nullish().transform(ur),fr=t.xi.object({profileName:dr,profileFamilyName:dr}).passthrough();function pr(e,n){let r=e.prepare(`SELECT * FROM conversations`).all(),i=e.prepare(`
    UPDATE conversations
    SET
      json = $json,
      profileName = $profileName,
      profileFamilyName = $profileFamilyName
    WHERE
      id is $id
  `),a=0;for(let e of r){let r=t.ii(fr,JSON.parse(e.json));if(!r.success){n.warn(`failed to parse conversation json ${e.id}`,r.error);continue}let{profileName:o,profileFamilyName:s}=r.data;if(o===(e.profileName??void 0)&&s===(e.profileFamilyName??void 0))continue;let c=JSON.stringify(r.data);a+=1,i.run({id:e.id,json:c,profileName:o??null,profileFamilyName:s??null})}a>0&&n.warn(`fixed ${a} conversation(s)`)}t.ct();function mr(e){let[n]=t.mt`
    UPDATE items
    SET json = json_set(
      json,
      '$.value',
      CASE json_extract(json, '$.value')
        WHEN 'EmojiSkinTone.None' THEN ''
        WHEN 'EmojiSkinTone.Type1' THEN '1F3FB'
        WHEN 'EmojiSkinTone.Type2' THEN '1F3FC'
        WHEN 'EmojiSkinTone.Type3' THEN '1F3FD'
        WHEN 'EmojiSkinTone.Type4' THEN '1F3FE'
        WHEN 'EmojiSkinTone.Type5' THEN '1F3FF'
        ELSE ''
      END
    )
    WHERE id IS 'emojiSkinToneDefault';
  `;e.exec(n)}t.ct();function hr(e){let[n,r]=t.mt`
    SELECT * FROM emojis;
  `;return e.prepare(n).all(r)}function gr(e){if(e.length===0)return[];let n=new Map;for(let[e,r]of Object.entries(t.r))n.set(r.shortName,e);let r=[];for(let t of e){if(t.shortName==null||t.lastUsage==null)continue;let e=n.get(t.shortName);e!=null&&r.push({emoji:e,lastUsedAt:t.lastUsage})}return r}function _r(e){let[n]=t.mt`
    CREATE TABLE recentEmojis (
      emoji TEXT NOT NULL PRIMARY KEY,
      lastUsedAt INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX recentEmojis_order ON recentEmojis (lastUsedAt DESC);
  `;e.exec(n)}function vr(e,t){if(t.length===0)return;let n=e.prepare(`
    INSERT INTO recentEmojis (emoji, lastUsedAt) VALUES ($emoji, $lastUsedAt);
  `);for(let e of t)n.run({emoji:e.emoji,lastUsedAt:e.lastUsedAt})}function yr(e){let[n]=t.mt`
    DROP TABLE emojis;
  `;e.exec(n)}function br(e){_r(e),vr(e,gr(hr(e))),yr(e)}t.g(),t.ct(),t.qr();const{keyBy:xr}=m.default;function Sr(e){e.exec(`
    CREATE TABLE messages(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      unread INTEGER,
      expires_at INTEGER,
      sent_at INTEGER,
      schemaVersion INTEGER,
      conversationId STRING,
      received_at INTEGER,
      source STRING,
      sourceDevice STRING,
      hasAttachments INTEGER,
      hasFileAttachments INTEGER,
      hasVisualMediaAttachments INTEGER
    );
    CREATE INDEX messages_unread ON messages (
      unread
    );
    CREATE INDEX messages_expires_at ON messages (
      expires_at
    );
    CREATE INDEX messages_receipt ON messages (
      sent_at
    );
    CREATE INDEX messages_schemaVersion ON messages (
      schemaVersion
    );
    CREATE INDEX messages_conversation ON messages (
      conversationId,
      received_at
    );
    CREATE INDEX messages_duplicate_check ON messages (
      source,
      sourceDevice,
      sent_at
    );
    CREATE INDEX messages_hasAttachments ON messages (
      conversationId,
      hasAttachments,
      received_at
    );
    CREATE INDEX messages_hasFileAttachments ON messages (
      conversationId,
      hasFileAttachments,
      received_at
    );
    CREATE INDEX messages_hasVisualMediaAttachments ON messages (
      conversationId,
      hasVisualMediaAttachments,
      received_at
    );
    CREATE TABLE unprocessed(
      id STRING,
      timestamp INTEGER,
      json TEXT
    );
    CREATE INDEX unprocessed_id ON unprocessed (
      id
    );
    CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );
  `)}function Cr(e){e.exec(`
    ALTER TABLE messages
      ADD COLUMN expireTimer INTEGER;

    ALTER TABLE messages
      ADD COLUMN expirationStartTimestamp INTEGER;

    ALTER TABLE messages
      ADD COLUMN type STRING;

    CREATE INDEX messages_expiring ON messages (
      expireTimer,
      expirationStartTimestamp,
      expires_at
    );

    UPDATE messages SET
      expirationStartTimestamp = json_extract(json, '$.expirationStartTimestamp'),
      expireTimer = json_extract(json, '$.expireTimer'),
      type = json_extract(json, '$.type');
  `)}function wr(e){e.exec(`
    DROP INDEX messages_expiring;
    DROP INDEX messages_unread;

    CREATE INDEX messages_without_timer ON messages (
      expireTimer,
      expires_at,
      type
    ) WHERE expires_at IS NULL AND expireTimer IS NOT NULL;

    CREATE INDEX messages_unread ON messages (
      conversationId,
      unread
    ) WHERE unread IS NOT NULL;

    ANALYZE;
  `)}function Tr(e){e.exec(`
    CREATE TABLE conversations(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      active_at INTEGER,
      type STRING,
      members TEXT,
      name TEXT,
      profileName TEXT
    );
    CREATE INDEX conversations_active ON conversations (
      active_at
    ) WHERE active_at IS NOT NULL;

    CREATE INDEX conversations_type ON conversations (
      type
    ) WHERE type IS NOT NULL;
  `)}function Er(e){e.exec(`
    -- key-value, ids are strings, one extra column
    CREATE TABLE sessions(
      id STRING PRIMARY KEY ASC,
      number STRING,
      json TEXT
    );
    CREATE INDEX sessions_number ON sessions (
      number
    ) WHERE number IS NOT NULL;
    -- key-value, ids are strings
    CREATE TABLE groups(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );
    CREATE TABLE identityKeys(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );
    CREATE TABLE items(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );
    -- key-value, ids are integers
    CREATE TABLE preKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );
    CREATE TABLE signedPreKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );
  `)}function Dr(e){e.exec(`
    -- SQLite has been coercing our STRINGs into numbers, so we force it with TEXT
    -- We create a new table then copy the data into it, since we can't modify columns
    DROP INDEX sessions_number;
    ALTER TABLE sessions RENAME TO sessions_old;

    CREATE TABLE sessions(
      id TEXT PRIMARY KEY,
      number TEXT,
      json TEXT
    );
    CREATE INDEX sessions_number ON sessions (
      number
    ) WHERE number IS NOT NULL;
    INSERT INTO sessions(id, number, json)
      SELECT '+' || id, number, json FROM sessions_old;
    DROP TABLE sessions_old;
  `)}function Or(e){e.exec(`
    -- First, we pull a new body field out of the message table's json blob
    ALTER TABLE messages
      ADD COLUMN body TEXT;
    UPDATE messages SET body = json_extract(json, '$.body');

    -- Then we create our full-text search table and populate it
    CREATE VIRTUAL TABLE messages_fts
      USING fts5(id UNINDEXED, body);

    INSERT INTO messages_fts(id, body)
      SELECT id, body FROM messages;

    -- Then we set up triggers to keep the full-text search table up to date
    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `)}function kr(e){e.exec(`
    CREATE TABLE attachment_downloads(
      id STRING primary key,
      timestamp INTEGER,
      pending INTEGER,
      json TEXT
    );

    CREATE INDEX attachment_downloads_timestamp
      ON attachment_downloads (
        timestamp
    ) WHERE pending = 0;
    CREATE INDEX attachment_downloads_pending
      ON attachment_downloads (
        pending
    ) WHERE pending != 0;
  `)}function Ar(e){e.exec(`
    DROP INDEX unprocessed_id;
    DROP INDEX unprocessed_timestamp;
    ALTER TABLE unprocessed RENAME TO unprocessed_old;

    CREATE TABLE unprocessed(
      id STRING,
      timestamp INTEGER,
      version INTEGER,
      attempts INTEGER,
      envelope TEXT,
      decrypted TEXT,
      source TEXT,
      sourceDevice TEXT,
      serverTimestamp INTEGER
    );

    CREATE INDEX unprocessed_id ON unprocessed (
      id
    );
    CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );

    INSERT INTO unprocessed (
      id,
      timestamp,
      version,
      attempts,
      envelope,
      decrypted,
      source,
      sourceDevice,
      serverTimestamp
    ) SELECT
      id,
      timestamp,
      json_extract(json, '$.version'),
      json_extract(json, '$.attempts'),
      json_extract(json, '$.envelope'),
      json_extract(json, '$.decrypted'),
      json_extract(json, '$.source'),
      json_extract(json, '$.sourceDevice'),
      json_extract(json, '$.serverTimestamp')
    FROM unprocessed_old;

    DROP TABLE unprocessed_old;
  `)}function jr(e){e.exec(`
    DROP TABLE groups;
  `)}function Mr(e){e.exec(`
    CREATE TABLE sticker_packs(
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,

      author STRING,
      coverStickerId INTEGER,
      createdAt INTEGER,
      downloadAttempts INTEGER,
      installedAt INTEGER,
      lastUsed INTEGER,
      status STRING,
      stickerCount INTEGER,
      title STRING
    );

    CREATE TABLE stickers(
      id INTEGER NOT NULL,
      packId TEXT NOT NULL,

      emoji STRING,
      height INTEGER,
      isCoverOnly INTEGER,
      lastUsed INTEGER,
      path STRING,
      width INTEGER,

      PRIMARY KEY (id, packId),
      CONSTRAINT stickers_fk
        FOREIGN KEY (packId)
        REFERENCES sticker_packs(id)
        ON DELETE CASCADE
    );

    CREATE INDEX stickers_recents
      ON stickers (
        lastUsed
    ) WHERE lastUsed IS NOT NULL;

    CREATE TABLE sticker_references(
      messageId STRING,
      packId TEXT,
      CONSTRAINT sticker_references_fk
        FOREIGN KEY(packId)
        REFERENCES sticker_packs(id)
        ON DELETE CASCADE
    );
  `)}function Nr(e){e.exec(`
    ALTER TABLE sticker_packs ADD COLUMN attemptedStatus STRING;
  `)}function Pr(e){e.exec(`
    CREATE TABLE emojis(
      shortName STRING PRIMARY KEY,
      lastUsage INTEGER
    );

    CREATE INDEX emojis_lastUsage
      ON emojis (
        lastUsage
    );
  `)}function Fr(e){e.exec(`
    -- SQLite has again coerced our STRINGs into numbers, so we force it with TEXT
    -- We create a new table then copy the data into it, since we can't modify columns

    DROP INDEX emojis_lastUsage;
    ALTER TABLE emojis RENAME TO emojis_old;

    CREATE TABLE emojis(
      shortName TEXT PRIMARY KEY,
      lastUsage INTEGER
    );
    CREATE INDEX emojis_lastUsage
      ON emojis (
        lastUsage
    );

    DELETE FROM emojis WHERE shortName = 1;
    INSERT INTO emojis(shortName, lastUsage)
      SELECT shortName, lastUsage FROM emojis_old;

    DROP TABLE emojis_old;
  `)}function Ir(e){e.exec(`
    ALTER TABLE messages
    ADD COLUMN messageTimer INTEGER;
    ALTER TABLE messages
    ADD COLUMN messageTimerStart INTEGER;
    ALTER TABLE messages
    ADD COLUMN messageTimerExpiresAt INTEGER;
    ALTER TABLE messages
    ADD COLUMN isErased INTEGER;

    CREATE INDEX messages_message_timer ON messages (
      messageTimer,
      messageTimerStart,
      messageTimerExpiresAt,
      isErased
    ) WHERE messageTimer IS NOT NULL;

    -- Updating full-text triggers to avoid anything with a messageTimer set

    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_delete;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.messageTimer IS NULL
    BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.messageTimer IS NULL
    BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `)}function Lr(e,t){try{e.exec(`
      ALTER TABLE messages
      ADD COLUMN isViewOnce INTEGER;

      DROP INDEX messages_message_timer;
    `)}catch{t.info(`Message table already had isViewOnce column`)}e.exec(`DROP INDEX IF EXISTS messages_view_once;`),e.exec(`
    CREATE INDEX messages_view_once ON messages (
      isErased
    ) WHERE isViewOnce = 1;

    -- Updating full-text triggers to avoid anything with isViewOnce = 1

    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.isViewOnce != 1
    BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `)}function Rr(e){e.exec(`
    -- Delete and rebuild full-text search index to capture everything

    DELETE FROM messages_fts;
    INSERT INTO messages_fts(messages_fts) VALUES('rebuild');

    INSERT INTO messages_fts(id, body)
    SELECT id, body FROM messages WHERE isViewOnce IS NULL OR isViewOnce != 1;

    -- Fixing full-text triggers

    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `)}function zr(e){e.exec(`
    ALTER TABLE conversations
    ADD COLUMN profileFamilyName TEXT;
    ALTER TABLE conversations
    ADD COLUMN profileFullName TEXT;

    -- Preload new field with the profileName we already have
    UPDATE conversations SET profileFullName = profileName;
  `)}function Br(e){let n=e.prepare(`SELECT * FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'messages'`).all();for(let t of n)e.exec(`DROP TRIGGER ${t.name}`);e.exec(`
    ALTER TABLE conversations ADD COLUMN e164 TEXT;
    ALTER TABLE conversations ADD COLUMN uuid TEXT;
    ALTER TABLE conversations ADD COLUMN groupId TEXT;
    ALTER TABLE messages ADD COLUMN sourceUuid TEXT;
    ALTER TABLE sessions RENAME COLUMN number TO conversationId;
    CREATE INDEX conversations_e164 ON conversations(e164);
    CREATE INDEX conversations_uuid ON conversations(uuid);
    CREATE INDEX conversations_groupId ON conversations(groupId);
    CREATE INDEX messages_sourceUuid on messages(sourceUuid);

    -- Migrate existing IDs
    UPDATE conversations SET e164 = '+' || id WHERE type = 'private';
    UPDATE conversations SET groupId = id WHERE type = 'group';
  `);let r=e.prepare(`SELECT * FROM conversations WHERE type = 'group' AND members IS NULL;`).all();for(let t of r){let n=JSON.parse(t.json);(!n.members||!n.members.length)&&(e.prepare(`DELETE FROM conversations WHERE id = $id;`).run({id:n.id}),e.prepare(`DELETE FROM messages WHERE conversationId = $id;`).run({id:n.id}))}let i=e.prepare(`SELECT * FROM conversations;`).all(),a=xr(i,`id`);for(let n of i){let r=n.id,i=t.v();a[r].id=i;let o={id:i};n.type===`private`?o.e164=`+${r}`:n.type===`group`&&(o.groupId=r);let s=JSON.stringify(o);e.prepare(`
      UPDATE conversations
      SET id = $newId, json = JSON_PATCH(json, $patch)
      WHERE id = $oldId
      `).run({newId:i,oldId:r,patch:s});let c=JSON.stringify({conversationId:i});e.prepare(`
      UPDATE messages
      SET conversationId = $newId, json = JSON_PATCH(json, $patch)
      WHERE conversationId = $oldId
      `).run({newId:i,oldId:r,patch:c})}e.prepare(`
      SELECT id, members, json FROM conversations WHERE type = 'group';
      `).all().forEach(n=>{let r=n.members.split(/\s?\+/).filter(Boolean),i=[];for(let n of r){let r=a[n];if(r)i.push(r.id);else{let r=t.v(),a={id:r,e164:n,type:`private`,version:2,unreadCount:0,verified:0,inbox_position:0,isPinned:!1,lastMessageDeletedForEveryone:!1,markedUnread:!1,messageCount:0,sentMessageCount:0,profileSharing:!1};e.prepare(`
          UPDATE conversations
          SET
            json = $json,
            e164 = $e164,
            type = $type
          WHERE
            id = $id;
          `).run({id:a.id,json:t.ut(a),e164:a.e164,type:a.type}),i.push(r)}}let o={...t.lt(n.json),members:i},s=i.join(` `);e.prepare(`
      UPDATE conversations
      SET members = $newMembersValue, json = $newJsonValue
      WHERE id = $id
      `).run({id:n.id,newMembersValue:s,newJsonValue:t.ut(o)})});let o=e.prepare(`SELECT * FROM sessions;`).all();for(let n of o){let r=JSON.parse(n.json),i=a[r.number.substr(1)];i&&(r.conversationId=i.id,r.id=`${r.conversationId}.${r.deviceId}`),delete r.number,e.prepare(`
      UPDATE sessions
      SET id = $newId, json = $newJson, conversationId = $newConversationId
      WHERE id = $oldId
      `).run({newId:r.id,newJson:t.ut(r),oldId:n.id,newConversationId:r.conversationId})}let s=e.prepare(`SELECT * FROM identityKeys;`).all();for(let n of s){let r=JSON.parse(n.json);r.id=a[r.id],e.prepare(`
      UPDATE identityKeys
      SET id = $newId, json = $newJson
      WHERE id = $oldId
      `).run({newId:r.id,newJson:t.ut(r),oldId:n.id})}for(let t of n)e.exec(t.sql)}function Vr(e){e.exec(`
    UPDATE conversations
    SET json = json_set(
      json,
      '$.messageCount',
      (SELECT count(*) FROM messages WHERE messages.conversationId = conversations.id)
    );
    UPDATE conversations
    SET json = json_set(
      json,
      '$.sentMessageCount',
      (SELECT count(*) FROM messages WHERE messages.conversationId = conversations.id AND messages.type = 'outgoing')
    );
  `)}function Hr(e){e.exec(`
    ALTER TABLE unprocessed
      ADD COLUMN sourceUuid STRING;
  `)}function Ur(e){e.exec(`
    -- Remove triggers which keep full-text search up to date
    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;
    DROP TRIGGER messages_on_delete;
  `)}function Wr(e){e.exec(`
    ALTER TABLE conversations
    ADD COLUMN profileLastFetchedAt INTEGER;
  `)}function Gr(e){e.exec(`
    ALTER TABLE messages
    RENAME TO old_messages
  `);for(let t of[`messages_expires_at`,`messages_receipt`,`messages_schemaVersion`,`messages_conversation`,`messages_duplicate_check`,`messages_hasAttachments`,`messages_hasFileAttachments`,`messages_hasVisualMediaAttachments`,`messages_without_timer`,`messages_unread`,`messages_view_once`,`messages_sourceUuid`])e.exec(`DROP INDEX IF EXISTS ${t};`);e.exec(`
    --
    -- Create a new table with a different primary key
    --

    CREATE TABLE messages(
      rowid INTEGER PRIMARY KEY ASC,
      id STRING UNIQUE,
      json TEXT,
      unread INTEGER,
      expires_at INTEGER,
      sent_at INTEGER,
      schemaVersion INTEGER,
      conversationId STRING,
      received_at INTEGER,
      source STRING,
      sourceDevice STRING,
      hasAttachments INTEGER,
      hasFileAttachments INTEGER,
      hasVisualMediaAttachments INTEGER,
      expireTimer INTEGER,
      expirationStartTimestamp INTEGER,
      type STRING,
      body TEXT,
      messageTimer INTEGER,
      messageTimerStart INTEGER,
      messageTimerExpiresAt INTEGER,
      isErased INTEGER,
      isViewOnce INTEGER,
      sourceUuid TEXT);

    -- Create index in lieu of old PRIMARY KEY
    CREATE INDEX messages_id ON messages (id ASC);

    --
    -- Recreate indices
    --

    CREATE INDEX messages_expires_at ON messages (expires_at);

    CREATE INDEX messages_receipt ON messages (sent_at);

    CREATE INDEX messages_schemaVersion ON messages (schemaVersion);

    CREATE INDEX messages_conversation ON messages
      (conversationId, received_at);

    CREATE INDEX messages_duplicate_check ON messages
      (source, sourceDevice, sent_at);

    CREATE INDEX messages_hasAttachments ON messages
      (conversationId, hasAttachments, received_at);

    CREATE INDEX messages_hasFileAttachments ON messages
      (conversationId, hasFileAttachments, received_at);

    CREATE INDEX messages_hasVisualMediaAttachments ON messages
      (conversationId, hasVisualMediaAttachments, received_at);

    CREATE INDEX messages_without_timer ON messages
      (expireTimer, expires_at, type)
      WHERE expires_at IS NULL AND expireTimer IS NOT NULL;

    CREATE INDEX messages_unread ON messages
      (conversationId, unread) WHERE unread IS NOT NULL;

    CREATE INDEX messages_view_once ON messages
      (isErased) WHERE isViewOnce = 1;

    CREATE INDEX messages_sourceUuid on messages(sourceUuid);

    -- New index for searchMessages
    CREATE INDEX messages_searchOrder on messages(received_at, sent_at);

    --
    -- Re-create messages_fts and add triggers
    --

    DROP TABLE messages_fts;

    CREATE VIRTUAL TABLE messages_fts USING fts5(body);

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
    END;

    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    --
    -- Copy data over
    --

    INSERT INTO messages
    (
      id, json, unread, expires_at, sent_at, schemaVersion, conversationId,
      received_at, source, sourceDevice, hasAttachments, hasFileAttachments,
      hasVisualMediaAttachments, expireTimer, expirationStartTimestamp, type,
      body, messageTimer, messageTimerStart, messageTimerExpiresAt, isErased,
      isViewOnce, sourceUuid
    )
    SELECT
      id, json, unread, expires_at, sent_at, schemaVersion, conversationId,
      received_at, source, sourceDevice, hasAttachments, hasFileAttachments,
      hasVisualMediaAttachments, expireTimer, expirationStartTimestamp, type,
      body, messageTimer, messageTimerStart, messageTimerExpiresAt, isErased,
      isViewOnce, sourceUuid
    FROM old_messages;

    -- Drop old database
    DROP TABLE old_messages;
  `)}function Kr(e){e.exec(`
    DROP TRIGGER messages_on_insert;
    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
    BEGIN
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN new.body != old.body AND
      (new.isViewOnce IS NULL OR new.isViewOnce != 1)
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;
  `)}function qr(e){e.exec(`
    DELETE FROM messages_fts WHERE rowid IN
      (SELECT rowid FROM messages WHERE body IS NULL);

    DROP TRIGGER messages_on_update;

    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN
      new.body IS NULL OR
      ((old.body IS NULL OR new.body != old.body) AND
       (new.isViewOnce IS NULL OR new.isViewOnce != 1))
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.body);
    END;

    CREATE TRIGGER messages_on_view_once_update AFTER UPDATE ON messages
    WHEN
      new.body IS NOT NULL AND new.isViewOnce = 1
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
    END;
  `)}function Jr(e){e.exec(`
    CREATE TABLE jobs(
      id TEXT PRIMARY KEY,
      queueType TEXT STRING NOT NULL,
      timestamp INTEGER NOT NULL,
      data STRING TEXT
    );

    CREATE INDEX jobs_timestamp ON jobs (timestamp);
  `)}function Yr(e){e.exec(`
    CREATE TABLE reactions(
      conversationId STRING,
      emoji STRING,
      fromId STRING,
      messageReceivedAt INTEGER,
      targetAuthorUuid STRING,
      targetTimestamp INTEGER,
      unread INTEGER
    );

    CREATE INDEX reactions_unread ON reactions (
      unread,
      conversationId
    );

    CREATE INDEX reaction_identifier ON reactions (
      emoji,
      targetAuthorUuid,
      targetTimestamp
    );
  `)}function Xr(e){e.exec(`
    CREATE TABLE senderKeys(
      id TEXT PRIMARY KEY NOT NULL,
      senderId TEXT NOT NULL,
      distributionId TEXT NOT NULL,
      data BLOB NOT NULL,
      lastUpdatedDate NUMBER NOT NULL
    );
  `)}function Zr(e){e.exec(`
    DROP INDEX unprocessed_id;
    DROP INDEX unprocessed_timestamp;
    ALTER TABLE unprocessed RENAME TO unprocessed_old;

    CREATE TABLE unprocessed(
      id STRING PRIMARY KEY ASC,
      timestamp INTEGER,
      version INTEGER,
      attempts INTEGER,
      envelope TEXT,
      decrypted TEXT,
      source TEXT,
      sourceDevice TEXT,
      serverTimestamp INTEGER,
      sourceUuid STRING
    );

    CREATE INDEX unprocessed_timestamp ON unprocessed (
      timestamp
    );

    INSERT OR REPLACE INTO unprocessed
      (id, timestamp, version, attempts, envelope, decrypted, source,
       sourceDevice, serverTimestamp, sourceUuid)
    SELECT
      id, timestamp, version, attempts, envelope, decrypted, source,
       sourceDevice, serverTimestamp, sourceUuid
    FROM unprocessed_old;

    DROP TABLE unprocessed_old;
  `)}function Qr(e){e.exec(`
    ALTER TABLE messages
    ADD COLUMN serverGuid STRING NULL;

    ALTER TABLE unprocessed
    ADD COLUMN serverGuid STRING NULL;
  `)}function $r(e){e.exec(`
    -- These indexes should exist, but we add "IF EXISTS" for safety.
    DROP INDEX IF EXISTS messages_expires_at;
    DROP INDEX IF EXISTS messages_without_timer;

    ALTER TABLE messages
    ADD COLUMN
    expiresAt INT
    GENERATED ALWAYS
    AS (expirationStartTimestamp + (expireTimer * 1000));

    CREATE INDEX message_expires_at ON messages (
      expiresAt
    );

    CREATE INDEX outgoing_messages_without_expiration_start_timestamp ON messages (
      expireTimer, expirationStartTimestamp, type
    )
    WHERE expireTimer IS NOT NULL AND expirationStartTimestamp IS NULL;
  `)}function ei(e){e.exec(`
    -- This index should exist, but we add "IF EXISTS" for safety.
    DROP INDEX IF EXISTS outgoing_messages_without_expiration_start_timestamp;

    CREATE INDEX messages_unexpectedly_missing_expiration_start_timestamp ON messages (
      expireTimer, expirationStartTimestamp, type
    )
    WHERE expireTimer IS NOT NULL AND expirationStartTimestamp IS NULL;
  `)}function ti(e){e.exec(`
    CREATE INDEX expiring_message_by_conversation_and_received_at
    ON messages
    (
      expirationStartTimestamp,
      expireTimer,
      conversationId,
      received_at
    );
  `)}function ni(){}function ri(e){e.exec(`
    -- Create send log primary table

    CREATE TABLE sendLogPayloads(
      id INTEGER PRIMARY KEY ASC,

      timestamp INTEGER NOT NULL,
      contentHint INTEGER NOT NULL,
      proto BLOB NOT NULL
    );

    CREATE INDEX sendLogPayloadsByTimestamp ON sendLogPayloads (timestamp);

    -- Create send log recipients table with foreign key relationship to payloads

    CREATE TABLE sendLogRecipients(
      payloadId INTEGER NOT NULL,

      recipientUuid STRING NOT NULL,
      deviceId INTEGER NOT NULL,

      PRIMARY KEY (payloadId, recipientUuid, deviceId),

      CONSTRAINT sendLogRecipientsForeignKey
        FOREIGN KEY (payloadId)
        REFERENCES sendLogPayloads(id)
        ON DELETE CASCADE
    );

    CREATE INDEX sendLogRecipientsByRecipient
      ON sendLogRecipients (recipientUuid, deviceId);

    -- Create send log messages table with foreign key relationship to payloads

    CREATE TABLE sendLogMessageIds(
      payloadId INTEGER NOT NULL,

      messageId STRING NOT NULL,

      PRIMARY KEY (payloadId, messageId),

      CONSTRAINT sendLogMessageIdsForeignKey
        FOREIGN KEY (payloadId)
        REFERENCES sendLogPayloads(id)
        ON DELETE CASCADE
    );

    CREATE INDEX sendLogMessageIdsByMessage
      ON sendLogMessageIds (messageId);

    -- Recreate messages table delete trigger with send log support

    DROP TRIGGER messages_on_delete;

    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
      DELETE FROM sendLogPayloads WHERE id IN (
        SELECT payloadId FROM sendLogMessageIds
        WHERE messageId = old.id
      );
    END;

    --- Add messageId column to reactions table to properly track proto associations

    ALTER TABLE reactions ADD column messageId STRING;
  `)}function ii(e){e.exec(`
    DROP INDEX IF EXISTS messages_duplicate_check;

    ALTER TABLE messages
      RENAME COLUMN sourceDevice TO deprecatedSourceDevice;
    ALTER TABLE messages
      ADD COLUMN sourceDevice INTEGER;

    UPDATE messages
    SET
      sourceDevice = CAST(deprecatedSourceDevice AS INTEGER),
      deprecatedSourceDevice = NULL;

    ALTER TABLE unprocessed
      RENAME COLUMN sourceDevice TO deprecatedSourceDevice;
    ALTER TABLE unprocessed
      ADD COLUMN sourceDevice INTEGER;

    UPDATE unprocessed
    SET
      sourceDevice = CAST(deprecatedSourceDevice AS INTEGER),
      deprecatedSourceDevice = NULL;
  `)}function ai(e){e.exec(`ALTER TABLE messages RENAME COLUMN unread TO readStatus;`)}function oi(e){e.exec(`
    CREATE TABLE groupCallRings(
      ringId INTEGER PRIMARY KEY,
      isActive INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
    `)}const j=[{version:1,update:Sr},{version:2,update:Cr},{version:3,update:wr},{version:4,update:Tr},{version:6,update:Er},{version:7,update:Dr},{version:8,update:Or},{version:9,update:kr},{version:10,update:Ar},{version:11,update:jr},{version:12,update:Mr},{version:13,update:Nr},{version:14,update:Pr},{version:15,update:Fr},{version:16,update:Ir},{version:17,update:Lr},{version:18,update:Rr},{version:19,update:zr},{version:20,update:Br},{version:21,update:Vr},{version:22,update:Hr},{version:23,update:Ur},{version:24,update:Wr},{version:25,update:Gr},{version:26,update:Kr},{version:27,update:qr},{version:28,update:Jr},{version:29,update:Yr},{version:30,update:Xr},{version:31,update:Zr},{version:32,update:Qr},{version:33,update:$r},{version:34,update:ei},{version:35,update:ti},{version:36,update:ni},{version:37,update:ri},{version:38,update:ii},{version:39,update:ai},{version:40,update:oi},{version:41,update:y},{version:42,update:b},{version:43,update:S},{version:44,update:ee},{version:45,update:te},{version:46,update:C},{version:47,update:w},{version:48,update:ne},{version:49,update:re},{version:50,update:ie},{version:51,update:ae},{version:52,update:oe},{version:53,update:se},{version:54,update:ce},{version:55,update:le},{version:56,update:ue},{version:57,update:de},{version:58,update:T},{version:59,update:fe},{version:60,update:pe},{version:61,update:me},{version:62,update:he},{version:63,update:ge},{version:64,update:_e},{version:65,update:ve},{version:66,update:ye},{version:67,update:be},{version:68,update:xe},{version:69,update:Se},{version:70,update:Ce},{version:71,update:we},{version:72,update:Te},{version:73,update:Ee},{version:74,update:De},{version:75,update:Oe},{version:76,update:ke},{version:77,update:Ae},{version:78,update:je},{version:79,update:Me},{version:80,update:Ne},{version:81,update:Pe},{version:82,update:Fe},{version:83,update:Ie},{version:84,update:Le},{version:85,update:Re},{version:86,update:ze},{version:87,update:He},{version:88,update:Ue},{version:89,update:ot},{version:90,update:ct},{version:91,update:lt},{version:920,update:Be},{version:930,update:ut},{version:940,update:dt},{version:950,update:ft},{version:960,update:pt},{version:970,update:_t},{version:980,update:vt},{version:990,update:yt},{version:1e3,update:Ct},{version:1010,update:wt},{version:1020,update:Tt},{version:1030,update:Et},{version:1040,update:Ot},{version:1050,update:kt},{version:1060,update:At},{version:1070,update:jt},{version:1080,update:Mt},{version:1090,update:Nt},{version:1100,update:Pt},{version:1110,update:Ft},{version:1120,update:It},{version:1130,update:Lt},{version:1140,update:Rt},{version:1150,update:zt},{version:1160,update:Ht},{version:1170,update:Ut},{version:1180,update:Wt},{version:1190,update:Gt},{version:1200,update:Kt},{version:1210,update:qt},{version:1220,update:cn},{version:1230,update:ln},{version:1240,update:un},{version:1250,update:dn},{version:1260,update:fn},{version:1270,update:pn},{version:1280,update:mn},{version:1290,update:hn},{version:1300,update:gn},{version:1310,update:_n},{version:1320,update:vn},{version:1330,update:yn},{version:1340,update:bn},{version:1350,update:xn},{version:1360,update:Sn},{version:1370,update:Cn},{version:1380,update:wn},{version:1390,update:Tn},{version:1400,update:En},{version:1410,update:Dn},{version:1420,update:On},{version:1430,update:kn},{version:1440,update:An},{version:1450,update:jn},{version:1460,update:Mn},{version:1470,update:Nn},{version:1480,update:Pn},{version:1490,update:Fn},{version:1500,update:Rn},{version:1510,update:zn},{version:1520,update:Bn},{version:1530,update:Vn},{version:1540,update:Hn},{version:1550,update:Un},{version:1560,update:Wn},{version:1561,update:Gn},{version:1570,update:Kn},{version:1580,update:qn},{version:1590,update:Jn},{version:1600,update:Yn},{version:1610,update:Xn},{version:1620,update:Zn},{version:1630,update:nr},{version:1640,update:rr},{version:1650,update:ir},{version:1660,update:ar},{version:1670,update:or},{version:1680,update:cr},{version:1690,update:lr},{version:1700,update:pr},{version:1710,update:mr},{version:1720,update:br}];var si=class extends Error{name=`DBVersionFromFutureError`};function ci(e,t){e.prepare(`
      SELECT v FROM messages_fts_config WHERE k is 'secure-delete';
    `,{pluck:!0}).get()!==1&&(t.info(`enableFTS5SecureDelete: enabling`),e.exec(`
      -- Enable secure-delete
      INSERT INTO messages_fts
      (messages_fts, rank)
      VALUES
      ('secure-delete', 1);
    `))}function li(e,n){let r=t.at(e),i=t.it(e),a=t.st(e),o=t.ot(e),s=j[j.length-1]?.version;t.Yr(s,`Missing MAX_VERSION`);for(let e=1;e<j.length;e+=1){let n=j[e-1]?.version,r=j[e]?.version;if(t.Yr(n,`Missing prev`),t.Yr(r,`Missing next`),n>=r)throw Error(`Migration versions are not monotonic: ${n} >= ${r}`)}if(n.info(`updateSchema:
`,` Current user_version: ${a};\n`,` Most recent db schema: ${s};\n`,` SQLite version: ${r};\n`,` SQLCipher version: ${i};\n`,` (deprecated) schema_version: ${o};\n`),a>s)throw new si(`SQL: User version is ${a} but the expected maximum version is ${s}.`);let c=0;for(;c<j.length;)e.transaction(()=>{for(;c<j.length;c+=1){let r=j[c];t.Yr(r,`Missing schema`);let{version:i,update:o}=r;if(i<=a)continue;let s=n.child(`updateSchema(${i})`);if(o(e,s,a)===`vacuum`)return s.info(`success, needs vacuum`),e.pragma(`user_version = ${i}`),c+=1,!0;s.info(`success`)}return e.pragma(`user_version = ${s}`),!1})()&&(n.info(`running vacuum`),e.exec(`VACUUM`),n.info(`done running vacuum`));if(vo.ensureMessageInsertTriggersAreEnabled(e),ci(e,n),a!==s){let t=Date.now();e.pragma(`optimize`);let r=Date.now()-t;n.info(`updateSchema: optimize took ${r}ms`)}}t.ct(),t.nn(),t.qr();const{groupBy:ui}=m.default,di=n.t(`hydrateMessage`);function fi(e){if(e!=null)return e===1}function M(e,t){return N(e,[t])[0]}function N(e,t){return hi(e,t.map(e=>{let t={...pi(e),hasAttachments:e.hasAttachments===1,hasFileAttachments:e.hasFileAttachments===1,hasVisualMediaAttachments:e.hasVisualMediaAttachments===1};return e.hasUnreadPollVotes===1?{...t,hasUnreadPollVotes:!0}:t}))}function pi(e){let{json:n,id:r,body:i,conversationId:a,expirationStartTimestamp:o,expireTimer:s,isErased:c,isViewOnce:l,mentionsMe:u,received_at:d,received_at_ms:f,schemaVersion:p,serverGuid:m,sent_at:h,source:g,sourceServiceId:_,sourceDevice:v,storyId:y,type:b,readStatus:x,seenStatus:S,timestamp:ee,serverTimestamp:te,unidentifiedDeliveryReceived:C}=e;return{...JSON.parse(n),id:r,body:t.u(i),conversationId:a||``,expirationStartTimestamp:t.u(o),expireTimer:t.u(s),isErased:fi(c),isViewOnce:fi(l),mentionsMe:fi(u),received_at:d||0,received_at_ms:t.u(f),schemaVersion:t.u(p),serverGuid:t.u(m),sent_at:h||0,source:t.u(g),sourceServiceId:t.u(_),sourceDevice:t.u(v),storyId:t.u(y),type:b,readStatus:x??void 0,seenStatus:S??void 0,timestamp:ee||0,serverTimestamp:t.u(te),unidentifiedDeliveryReceived:fi(C)}}function mi(e,n){return t.X(e,n,(n,r)=>{let[i,a]=t.mt`
      SELECT * FROM message_attachments
      WHERE messageId IN (${t.vt(n)});
    `;return e.prepare(i,{persistent:r}).all(a)})}function hi(e,n){let r=ui(mi(e,n.map(e=>e.id)),`messageId`);return n.map(e=>{let{hasAttachments:n,hasFileAttachments:i,hasVisualMediaAttachments:a,...o}=e,s=r[o.id]??[];if(!s.length)return o.attachments?.length||o.isErased||o.deletedForEveryone||o.isViewOnce||o.type!==`incoming`&&o.type!==`outgoing`||!n&&!i&&!a?o:(di.warn(`Retrieved message that should have attachments but missing message_attachment rows, timestamp: ${o.timestamp}`),{...o,attachments:[{error:!0,size:0,width:a?150:void 0,height:a?150:void 0,contentType:a?t.Yt:t.Ut}]});let c=ui(s,`editHistoryIndex`),l=gi(o,c[-1]??[]);return l.editHistory&&=l.editHistory.map((e,t)=>gi(e,c[t]??[])),l})}function gi(e,t){let n=ui(t,`attachmentType`),r=n.attachment??[],i=n[`long-message`]??[],a=n.quote??[],o=n.preview??[],s=n.contact??[],c=(n.sticker??[]).find(e=>e.orderInMessage===0),l=structuredClone(e);return r.length&&(l.attachments=r.sort((e,t)=>e.orderInMessage-t.orderInMessage).map(P)),i[0]&&(l.bodyAttachment=P(i[0])),l.quote?.attachments.forEach((e,t)=>{let n=a.find(e=>e.orderInMessage===t);n&&(e.thumbnail=P(n))}),l.preview?.forEach((e,t)=>{let n=o.find(e=>e.orderInMessage===t);n&&(e.image=P(n))}),l.contact?.forEach((e,t)=>{let n=s.find(e=>e.orderInMessage===t);n&&e.avatar&&(e.avatar.avatar=P(n))}),l.sticker&&c&&(l.sticker.data=P(c)),l}function P(e){let n=t.p(e);t.Yr(n!=null,`must exist`);let{clientUuid:r,size:i,duration:a,contentType:o,plaintextHash:s,path:c,localKey:l,caption:u,blurHash:d,height:f,width:p,digest:m,key:h,downloadPath:g,flags:_,fileName:v,version:y,incrementalMac:b,incrementalMacChunkSize:x,transitCdnKey:S,transitCdnNumber:ee,transitCdnUploadTimestamp:te,error:C,pending:w,wasTooBig:ne,isCorrupted:re,backfillError:ie,storyTextAttachmentJson:ae,copiedFromQuotedAttachment:oe,localBackupPath:se}=n;return{clientUuid:r,size:i,duration:a,contentType:t.ln(o),plaintextHash:s,path:c,localKey:l,caption:u,blurHash:d,height:f,width:p,digest:m,key:h,downloadPath:g,localBackupPath:se,flags:_,fileName:v,version:y,incrementalMac:b,chunkSize:x,cdnKey:S,cdnNumber:ee,uploadTimestamp:te,pending:t.$(w),error:t.$(C),wasTooBig:t.$(ne),copied:t.$(oe),isCorrupted:t.$(re),backfillError:t.$(ie),textAttachment:ae?t.lt(ae):void 0,backupCdnNumber:n.backupCdnNumber,...n.thumbnailPath?{thumbnail:{path:n.thumbnailPath,size:n.thumbnailSize??0,contentType:n.thumbnailContentType?t.ln(n.thumbnailContentType):t.Jt,localKey:n.thumbnailLocalKey,version:n.thumbnailVersion}}:{},...n.screenshotPath?{screenshot:{path:n.screenshotPath,size:n.screenshotSize??0,contentType:n.screenshotContentType?t.ln(n.screenshotContentType):t.Jt,localKey:n.screenshotLocalKey,version:n.screenshotVersion}}:{},...n.backupThumbnailPath?{thumbnailFromBackup:{path:n.backupThumbnailPath,size:n.backupThumbnailSize??0,contentType:n.backupThumbnailContentType?t.ln(n.backupThumbnailContentType):t.Jt,localKey:n.backupThumbnailLocalKey,version:n.backupThumbnailVersion}}:{}}}t.bi(),t.bt(),t.nn();const _i=t.Ri({type:t.Fi(`standard`),mediaName:t.Vi(),data:t.Ri({path:t.Vi(),size:t.Li(),contentType:t.Qt,keys:t.Vi(),transitCdnInfo:t.Ri({cdnKey:t.Vi(),cdnNumber:t.Li(),uploadTimestamp:t.Li().optional()}).optional(),version:t.Hi([t.Fi(1),t.Fi(2)]).optional(),localKey:t.Vi().optional()})}),vi=t.Vi().refine(e=>e.endsWith(`_thumbnail`)),yi=t.Ri({type:t.Fi(`thumbnail`),mediaName:vi,data:t.Ri({fullsizePath:t.Vi(),fullsizeSize:t.Li(),contentType:t.Qt,version:t.Hi([t.Fi(1),t.Fi(2)]).optional(),localKey:t.Vi().optional()})}),bi=t.Ri({receivedAt:t.Li()}).and(t.Ni(`type`,[_i,yi])).and(t.xt);t.ci(),i.rr(),t.Pr(),i.K(),i.L(),i.T(),t.ct(),t.qr(),i.vt(),t.Xr();function xi(e,n){let[r,i]=t.mt`
    SELECT 1
    FROM callLinks
    WHERE roomId = ${n};
  `;return e.prepare(r,{pluck:!0}).get(i)===1}function Si(e,t){let n=Ci(e,t);if(n)return i.h(n)}function Ci(e,n){let r=e.prepare(`SELECT * FROM callLinks WHERE roomId = $roomId`).get({roomId:n});if(r)return t.ei(i.U,r)}function wi(e){let[n]=t.mt`
    SELECT * FROM callLinks;
  `;return e.prepare(n).all().map(e=>i.h(t.ei(i.U,e)))}function Ti(e,t){let{roomId:n,rootKey:r}=t;ji(n,r);let a=i.v(t);e.prepare(`
    INSERT INTO callLinks (
      roomId,
      rootKey,
      adminKey,
      name,
      restrictions,
      revoked,
      expiration,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
    ) VALUES (
      $roomId,
      $rootKey,
      $adminKey,
      $name,
      $restrictions,
      $revoked,
      $expiration,
      $storageID,
      $storageVersion,
      $storageUnknownFields,
      $storageNeedsSync
    )
    `).run(a)}function Ei(e,t){Ti(e,t)}function Di(e,t){let{roomId:n,adminKey:r}=t;return e.transaction(()=>{let i=Si(e,n);return i?r&&r!==i.adminKey?(Ai(e,n,r),{callLink:{...i,adminKey:r},inserted:!1,updated:!0}):{callLink:i,inserted:!1,updated:!1}:(Ei(e,t),{callLink:t,inserted:!0,updated:!1})})()}function Oi(e,t){let{roomId:n,rootKey:r}=t;ji(n,r);let a=i.v(t);e.prepare(`
    UPDATE callLinks
    SET
      adminKey = $adminKey,
      name = $name,
      restrictions = $restrictions,
      revoked = $revoked,
      expiration = $expiration,
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE roomId = $roomId
    `).run(a)}function ki(e,n,r){let{name:a,restrictions:o,expiration:s,revoked:c}=r,[l,u]=t.mt`
    UPDATE callLinks
    SET
      name = ${a},
      restrictions = ${t.$r(i.W,o)},
      expiration = ${s},
      revoked = ${+!!c}
    WHERE roomId = ${n}
    RETURNING *;
  `,d=e.prepare(l).get(u);return t.Yr(d,`Expected row to be returned`),i.h(t.ei(i.U,d))}function Ai(e,t,n){let r=i.z(n);e.prepare(`
     UPDATE callLinks
     SET adminKey = $adminKeyBytes
     WHERE roomId = $roomId;
     `).run({roomId:t,adminKeyBytes:r})}function ji(e,n){let r=f.CallLinkRootKey.parse(n).deriveRoomId();t.Yr(e===t.Hr(r),`passed roomId must match roomId derived from root key`)}function Mi(e,n){let[r,a]=t.mt`
    UPDATE callsHistory
    SET
      status = ${i.at.Deleted},
      timestamp = ${Date.now()}
    WHERE peerId = ${n}
  `;e.prepare(r).run(a)}function Ni(e,n){e.transaction(()=>{let[r,i]=t.mt`
      DELETE FROM callLinks
      WHERE roomId = ${n};
    `;e.prepare(r).run(i),Mi(e,n)})()}function Pi(e,n){return e.transaction(()=>{let[r,i]=t.mt`
      DELETE FROM callLinks
      WHERE adminKey IS NULL
      AND roomId = ${n};
    `;if(e.prepare(r).run(i).changes!==0)return!1;let[a,o]=t.mt`
        UPDATE callLinks
        SET
          deleted = 1,
          deletedAt = ${new Date().getTime()},
          storageNeedsSync = 1
        WHERE adminKey IS NOT NULL
        AND deleted IS NOT 1
        AND roomId = ${n};
      `;return e.prepare(a).run(o).changes>0})()}function Fi(e,n){e.transaction(()=>{let[r,a]=t.mt`
      DELETE FROM callLinks
        WHERE roomId = ${n};
    `;e.prepare(r).run(a);let[o,s]=t.mt`
      UPDATE callsHistory
      SET
        status = ${i.ct.Deleted},
        timestamp = ${Date.now()}
      WHERE peerId = ${n};
    `;e.prepare(o).run(s)})()}function Ii(e){let n=new Date().getTime();return e.transaction(()=>{let[r,i]=t.mt`
      UPDATE callLinks
      SET
        deleted = 1,
        deletedAt = ${n},
        storageNeedsSync = 1
      WHERE adminKey IS NOT NULL
      AND deleted IS NOT 1;
    `,a=e.prepare(r).run(i),[o]=t.mt`
      DELETE FROM callLinks
      WHERE adminKey IS NULL;
    `;return e.prepare(o).run(),a.changes>0})()}function Li(e){let[n]=t.mt`
    SELECT * FROM callLinks
      WHERE adminKey IS NOT NULL
      AND rootKey IS NOT NULL;
  `;return e.prepare(n).all().map(e=>t.ei(i.U,e))}function Ri(e){return Li(e).map(e=>i.h(e))}function zi(e){let[n]=t.mt`
    SELECT roomId FROM callLinks WHERE deleted = 1;
  `;return e.prepare(n,{pluck:!0}).all()}function Bi(e,n){let[r,i]=t.mt`
    DELETE FROM callLinks
      WHERE roomId = ${n}
      AND deleted = 1
      AND storageNeedsSync = 0;
  `;e.prepare(r).run(i)}function Vi(e){let[n,r]=t.mt`
    DELETE FROM callLinks;
  `;e.prepare(n).run(r)}function Hi(e,n){let[r,i]=t.mt`
    SELECT 1
    FROM defunctCallLinks
    WHERE roomId = ${n};
  `;return e.prepare(r,{pluck:!0}).get(i)===1}function Ui(e){let[n]=t.mt`
    SELECT *
    FROM defunctCallLinks
    WHERE adminKey IS NOT NULL;
  `;return e.prepare(n).all().map(e=>i.y(t.ei(i.G,e)))}function Wi(e,t){let{roomId:n,rootKey:r}=t;ji(n,r);let a=i.b(t);e.prepare(`
    INSERT INTO defunctCallLinks (
      roomId,
      rootKey,
      adminKey,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
    ) VALUES (
      $roomId,
      $rootKey,
      $adminKey,
      $storageID,
      $storageVersion,
      $storageUnknownFields,
      $storageNeedsSync
    )
    ON CONFLICT (roomId) DO NOTHING;
    `).run(a)}function Gi(e,t){let{roomId:n,rootKey:r}=t;ji(n,r);let a=i.b(t);e.prepare(`
    UPDATE callLinks
    SET
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE roomId = $roomId
    `).run(a)}t.ct();function Ki(e){return e.prepare(`SELECT * FROM donationReceipts ORDER BY timestamp DESC;`).all()}function qi(e,n){let[r,i]=t.mt`SELECT * FROM donationReceipts WHERE id = ${n}`;return e.prepare(r).get(i)}function Ji(e){e.prepare(`DELETE FROM donationReceipts;`).run()}function Yi(e,n){let[r,i]=t.mt`DELETE FROM donationReceipts WHERE id = ${n};`;e.prepare(r).run(i)}function Xi(e,t){e.prepare(`
      INSERT INTO donationReceipts(
        id,
        currencyType,
        paymentAmount,
        timestamp
      ) VALUES (
        $id,
        $currencyType,
        $paymentAmount,
        $timestamp
      );
      `).run(t)}i.Wt(),t.ct(),t.qr(),t.Xr();function Zi(e,t){e.transaction(()=>{let{combinedEndorsement:n,memberEndorsements:r}=t,{groupId:i}=n;Qi(e,i),$i(e,n),ea(e,r)})()}function Qi(e,n){let[r,i]=t.mt`
    DELETE FROM groupSendCombinedEndorsement
    WHERE groupId = ${n};
  `,[a,o]=t.mt`
    DELETE FROM groupSendMemberEndorsement
    WHERE groupId IS ${n};
  `;e.prepare(r).run(i),e.prepare(a).run(o)}function $i(e,n){let{groupId:r,expiration:i,endorsement:a}=n,[o,s]=t.mt`
    INSERT OR REPLACE INTO groupSendCombinedEndorsement
    (groupId, expiration, endorsement)
    VALUES (${r}, ${i}, ${a});
  `;t.Yr(e.prepare(o).run(s).changes===1,`Must update groupSendCombinedEndorsement`)}function ea(e,n){for(let r of n){let{groupId:n,memberAci:i,expiration:a,endorsement:o}=r,[s,c]=t.mt`
      INSERT OR REPLACE INTO groupSendMemberEndorsement
      (groupId, memberAci, expiration, endorsement)
      VALUES (${n}, ${i}, ${a}, ${o});
    `;t.Yr(e.prepare(s).run(c).changes===1,`Must update groupSendMemberEndorsement`)}}function ta(e,t){e.transaction(()=>{Qi(e,t)})()}function na(e,n){let[r,a]=t.mt`
    SELECT expiration FROM groupSendCombinedEndorsement
    WHERE groupId IS ${n};
  `,o=e.prepare(r,{pluck:!0}).get(a);return o==null?null:t.ei(i.Vt,o)}function ra(e,n){return e.transaction(()=>{let[r,a]=t.mt`
      SELECT * FROM groupSendCombinedEndorsement
      WHERE groupId IS ${n}
    `,[o,s]=t.mt`
      SELECT * FROM groupSendMemberEndorsement
      WHERE groupId IS ${n}
    `,c=e.prepare(r).get(a);return c==null?null:t.Zr(i.Ht,{combinedEndorsement:c,memberEndorsements:e.prepare(o).all(s)})})()}function ia(e,n,r){let[a,o]=t.mt`
    SELECT * FROM groupSendMemberEndorsement
    WHERE groupId IS ${n}
    AND memberAci IS ${r}
  `,s=e.prepare(a).get(o);return s==null?null:t.ei(i.Ut,s)}t.g(),i.At(),t.ct(),t.qr(),i.xt();function aa(e){return{...e,showOnlyUnread:+!!e.showOnlyUnread,showMutedChats:+!!e.showMutedChats,includeAllIndividualChats:+!!e.includeAllIndividualChats,includeAllGroupChats:+!!e.includeAllGroupChats,includedConversationIds:JSON.stringify(e.includedConversationIds),excludedConversationIds:JSON.stringify(e.excludedConversationIds),storageNeedsSync:+!!e.storageNeedsSync}}function oa(e){return{...e,showOnlyUnread:e.showOnlyUnread===1,showMutedChats:e.showMutedChats===1,includeAllIndividualChats:e.includeAllIndividualChats===1,includeAllGroupChats:e.includeAllGroupChats===1,includedConversationIds:JSON.parse(e.includedConversationIds),excludedConversationIds:JSON.parse(e.excludedConversationIds),storageNeedsSync:e.storageNeedsSync===1}}function sa(e){let[n,r]=t.mt`
    SELECT * FROM chatFolders
  `;return e.prepare(n).all(r).map(e=>oa(e))}function ca(e){let[n,r]=t.mt`
    SELECT *
    FROM chatFolders
    WHERE folderType IS NOT ${i.kt.UNKNOWN}
    AND deletedAtTimestampMs IS 0
    ORDER BY position ASC
  `;return e.prepare(n).all(r).map(e=>{let n=oa(e);return t.Yr(i.Ct(n),`Query returned row that is not a current chat folder (${n.id})`),n})}function la(e,n){let[r,i]=t.mt`
    SELECT * FROM chatFolders
    WHERE id = ${n};
  `,a=e.prepare(r).get(i);return a==null?null:oa(a)}function ua(e,n){let r=aa(n),[i,a]=t.mt`
    INSERT INTO chatFolders (
      id,
      folderType,
      name,
      position,
      showOnlyUnread,
      showMutedChats,
      includeAllIndividualChats,
      includeAllGroupChats,
      includedConversationIds,
      excludedConversationIds,
      deletedAtTimestampMs,
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync
    ) VALUES (
      ${r.id},
      ${r.folderType},
      ${r.name},
      ${r.position},
      ${r.showOnlyUnread},
      ${r.showMutedChats},
      ${r.includeAllIndividualChats},
      ${r.includeAllGroupChats},
      ${r.includedConversationIds},
      ${r.excludedConversationIds},
      ${r.deletedAtTimestampMs},
      ${r.storageID},
      ${r.storageVersion},
      ${r.storageUnknownFields},
      ${r.storageNeedsSync}
    )
  `;e.prepare(i).run(a)}function da(e,t){return e.transaction(()=>{ua(e,t)})()}function fa(e){let[n,r]=t.mt`
    SELECT EXISTS (
      SELECT 1 FROM chatFolders
      WHERE folderType IS ${i.kt.ALL}
      AND deletedAtTimestampMs IS 0
      LIMIT 1
    )
  `;return e.prepare(n,{pluck:!0}).get(r)===1}function pa(e){return e.transaction(()=>{let n={id:t.v(),...i.wt,position:0,deletedAtTimestampMs:0,storageID:null,storageVersion:null,storageUnknownFields:null,storageNeedsSync:!0};return ya(e,1),ua(e,n),n})()}function ma(e,n){return e.transaction(()=>{if(t.Yr(n.folderType===i.kt.ALL,`Chat folder must have folderType=ALL`),fa(e)){let r=aa(n),[a,o]=t.mt`
        UPDATE chatFolders
        SET
          id = ${r.id},
          position = ${r.position},
          storageID = ${r.storageID},
          storageVersion = ${r.storageVersion},
          storageUnknownFields = ${r.storageUnknownFields},
          storageNeedsSync = ${r.storageNeedsSync}
        WHERE
          folderType = ${i.kt.ALL}
      `;e.prepare(a).run(o)}else ua(e,n)})()}function ha(e,n){let r=aa(n),[i,a]=t.mt`
    UPDATE chatFolders
    SET
      id = ${r.id},
      folderType = ${r.folderType},
      name = ${r.name},
      position = ${r.position},
      showOnlyUnread = ${r.showOnlyUnread},
      showMutedChats = ${r.showMutedChats},
      includeAllIndividualChats = ${r.includeAllIndividualChats},
      includeAllGroupChats = ${r.includeAllGroupChats},
      includedConversationIds = ${r.includedConversationIds},
      excludedConversationIds = ${r.excludedConversationIds},
      deletedAtTimestampMs = ${r.deletedAtTimestampMs},
      storageID = ${r.storageID},
      storageVersion = ${r.storageVersion},
      storageUnknownFields = ${r.storageUnknownFields},
      storageNeedsSync = ${r.storageNeedsSync}
    WHERE
      id = ${r.id}
  `;e.prepare(i).run(a)}function ga(e,n,r,i){return e.transaction(()=>{let a=la(e,n);t.Yr(a!=null,`Missing chat folder for id: ${n}`);let o=new Set(a.includedConversationIds),s=new Set(a.excludedConversationIds);i?(o.add(r),s.delete(r)):(o.delete(r),s.add(r)),ha(e,{...a,includedConversationIds:Array.from(o),excludedConversationIds:Array.from(s),storageNeedsSync:!0})})()}const _a=JSON.stringify([]);function va(e,n,r,a){return e.transaction(()=>{let[o,s]=t.mt`
      UPDATE chatFolders
      SET
        position = ${i.Et},
        deletedAtTimestampMs = ${r},
        storageNeedsSync = ${+!!a},
        includedConversationIds = ${_a},
        excludedConversationIds = ${_a}
      WHERE id = ${n}
    `;e.prepare(o).run(s),ya(e,0)})()}function ya(e,n){let[r,i]=t.mt`
    SELECT id FROM chatFolders
    WHERE deletedAtTimestampMs IS 0
    ORDER BY position ASC
  `;e.prepare(r,{pluck:!0}).all(i).forEach((r,i)=>{let[a,o]=t.mt`
        UPDATE chatFolders
        SET
          position = ${n+i},
          storageNeedsSync = 1
        WHERE id = ${r}
      `;e.prepare(a).run(o)})}function ba(e,n){return e.transaction(()=>{for(let r of n){let[n,i]=t.mt`
        UPDATE chatFolders
        SET
          position = ${r.position},
          storageNeedsSync = 1
        WHERE id = ${r.id}
      `;e.prepare(n).run(i)}})()}function xa(e,n,r){return e.transaction(()=>{let[i,a]=t.mt`
      UPDATE chatFolders
      SET deletedAtTimestampMs = ${r}
      WHERE id = ${n}
    `;e.prepare(i).run(a)})()}function Sa(e){let[n,r]=t.mt`
    SELECT *
    FROM chatFolders
    WHERE deletedAtTimestampMs > 0
    ORDER BY deletedAtTimestampMs ASC
    LIMIT 1
  `,i=e.prepare(n).get(r);return i==null?null:oa(i)}function Ca(e,n){let[r,i]=t.mt`
    DELETE FROM chatFolders
    WHERE deletedAtTimestampMs > 0
      AND deletedAtTimestampMs < ${Date.now()-n}
    RETURNING id
  `;return e.prepare(r,{pluck:!0}).all(i)}t.qr(),t.ct();function wa(e,n){let[r,i]=t.mt`
    SELECT * FROM messages
    WHERE id = ${n}
  `,a=e.prepare(r).get(i);return a==null?null:M(e,a)}function Ta(e,n){let r=wa(e,n.messageId);return t.Yr(r!=null,`Missing message ${n.messageId} for pinned message ${n.id}`),{pinnedMessage:n,message:r}}function Ea(e){let[n,r]=t.mt`
    SELECT * FROM pinnedMessages;
  `;return e.prepare(n).all(r)}function Da(e,n){return e.transaction(()=>{let[r,i]=t.mt`
      SELECT * FROM pinnedMessages
      WHERE conversationId = ${n}
      ORDER BY pinnedAt ASC
    `;return e.prepare(r).all(i).map(t=>Ta(e,t))})()}function Oa(e,n){let[r,i]=t.mt`
    SELECT * FROM pinnedMessages
    WHERE messageId IS ${n}
  `;return e.prepare(r).get(i)??null}function ka(e,n){let[r,i]=t.mt`
    INSERT INTO pinnedMessages (
      conversationId,
      messageId,
      pinnedAt,
      expiresAt
    ) VALUES (
      ${n.conversationId},
      ${n.messageId},
      ${n.pinnedAt},
      ${n.expiresAt}
    )
    RETURNING *;
  `,a=e.prepare(r).get(i);return t.Yr(a!=null,`createPinnedMessage: Failed to insert`),a}function Aa(e,n){let[r,i]=t.mt`
    DELETE FROM pinnedMessages
    WHERE id = ${n}
  `,a=e.prepare(r).run(i);t.Yr(a.changes===1,`deletePinnedMessage: Expected changes: 1, Actual: ${a.changes}`)}function ja(e,n,r){let[i,a]=t.mt`
    DELETE FROM pinnedMessages
    WHERE conversationId = ${n}
    AND id NOT IN (
      SELECT id FROM pinnedMessages
      WHERE conversationId = ${n}
      ORDER BY pinnedAt DESC
      LIMIT ${r}
    )
    RETURNING id
  `;return e.prepare(i,{pluck:!0}).all(a)}function Ma(e,t,n){return e.transaction(()=>{let r=Oa(e,n.messageId),i;i=r==null?!0:n.pinnedAt>r.pinnedAt;let a=null;if(i){let t=null;r!=null&&(Aa(e,r.id),t=r.id),a={inserted:ka(e,n),replaced:t}}let o=ja(e,n.conversationId,t);return{change:a,truncated:o}})()}function Na(e,n){let[r,i]=t.mt`
    DELETE FROM pinnedMessages
    WHERE messageId = ${n}
    RETURNING id
  `;return e.prepare(r,{pluck:!0}).get(i)??null}function Pa(e){let[n,r]=t.mt`
    SELECT * FROM pinnedMessages
    WHERE expiresAt IS NOT null
    ORDER BY expiresAt ASC
    LIMIT 1
  `;return e.prepare(n).get(r)??null}function Fa(e,n){let[r,i]=t.mt`
    DELETE FROM pinnedMessages
    WHERE expiresAt <= ${n}
    RETURNING *
  `;return e.prepare(r).all(i)}t.ct(),t.qr();function Ia(e){return{...e,isFinished:+!!e.isFinished,primaryCtaDataJson:e.primaryCtaData==null?null:JSON.stringify(e.primaryCtaData),secondaryCtaDataJson:e.secondaryCtaData==null?null:JSON.stringify(e.secondaryCtaData)}}function La(e){return{...e,isFinished:e.isFinished===1,primaryCtaData:e.primaryCtaDataJson==null?null:JSON.parse(e.primaryCtaDataJson),secondaryCtaData:e.secondaryCtaDataJson==null?null:JSON.parse(e.secondaryCtaDataJson)}}function Ra(e,n){let[r,i]=t.mt`
    SELECT EXISTS (
      SELECT 1 FROM megaphones
      WHERE id = ${n}
    )
  `;return e.prepare(r,{pluck:!0}).get(i)===1}function za(e){let[n,r]=t.mt`
    SELECT * FROM megaphones
  `;return e.prepare(n).all(r).map(e=>La(e))}function Ba(e){let[n,r]=t.mt`
    SELECT id FROM megaphones
  `;return e.prepare(n,{pluck:!0}).all(r)}function Va(e,n){let r=Ia(n),[i,a]=t.mt`
    INSERT INTO megaphones (
      id,
      desktopMinVersion,
      priority,
      dontShowBeforeEpochMs,
      dontShowAfterEpochMs,
      showForNumberOfDays,
      primaryCtaId,
      secondaryCtaId,
      primaryCtaDataJson,
      secondaryCtaDataJson,
      conditionalId,
      title,
      body,
      primaryCtaText,
      secondaryCtaText,
      imagePath,
      localeFetched,
      shownAt,
      snoozedAt,
      snoozeCount,
      isFinished
    ) VALUES (
      ${r.id},
      ${r.desktopMinVersion},
      ${r.priority},
      ${r.dontShowBeforeEpochMs},
      ${r.dontShowAfterEpochMs},
      ${r.showForNumberOfDays},
      ${r.primaryCtaId},
      ${r.secondaryCtaId},
      ${r.primaryCtaDataJson},
      ${r.secondaryCtaDataJson},
      ${r.conditionalId},
      ${r.title},
      ${r.body},
      ${r.primaryCtaText},
      ${r.secondaryCtaText},
      ${r.imagePath},
      ${r.localeFetched},
      ${r.shownAt},
      ${r.snoozedAt},
      ${r.snoozeCount},
      ${r.isFinished}
    )
  `;e.prepare(i).run(a)}function Ha(e,t){return e.transaction(()=>{Va(e,t)})()}function Ua(e,n){let r=Ia(n),[i,a]=t.mt`
    UPDATE megaphones
    SET
      desktopMinVersion = ${r.desktopMinVersion},
      priority = ${r.priority},
      dontShowBeforeEpochMs = ${r.dontShowBeforeEpochMs},
      dontShowAfterEpochMs = ${r.dontShowAfterEpochMs},
      showForNumberOfDays = ${r.showForNumberOfDays},
      primaryCtaId = ${r.primaryCtaId},
      secondaryCtaId = ${r.secondaryCtaId},
      primaryCtaDataJson = ${r.primaryCtaDataJson},
      secondaryCtaDataJson = ${r.secondaryCtaDataJson},
      conditionalId = ${r.conditionalId},
      title = ${r.title},
      body = ${r.body},
      primaryCtaText = ${r.primaryCtaText},
      secondaryCtaText = ${r.secondaryCtaText},
      imagePath = ${r.imagePath},
      localeFetched = ${r.localeFetched},
      shownAt = ${r.shownAt},
      snoozedAt = ${r.snoozedAt},
      snoozeCount = ${r.snoozeCount},
      isFinished = ${r.isFinished}
    WHERE
      id = ${r.id}
  `;e.prepare(i).run(a)}function Wa(e,n){let[r,i]=t.mt`
    UPDATE megaphones
    SET isFinished = 1
    WHERE id = ${n}
  `,a=e.prepare(r).run(i);t.Yr(a.changes===1,`finishMegaphone: Expected changes: 1, Actual: ${a.changes}`)}function Ga(e,n){let[r,i]=t.mt`
    UPDATE megaphones
    SET
      snoozedAt = ${Date.now()},
      snoozeCount = snoozeCount + 1
    WHERE id = ${n}
  `,a=e.prepare(r).run(i);t.Yr(a.changes===1,`snoozeMegaphone: Expected changes: 1, Actual: ${a.changes}`)}function Ka(e,n){let[r,i]=t.mt`
    DELETE FROM megaphones
    WHERE id = ${n}
  `,a=e.prepare(r).run(i);t.Yr(a.changes===1,`deleteMegaphone: Expected changes: 1, Actual: ${a.changes}`)}function qa(e){let[n,r]=t.mt`
    DELETE FROM megaphones
  `;return e.prepare(n).run(r).changes}function Ja(e){let t=e.prepare(`SELECT imagePath FROM megaphones WHERE imagePath IS NOT NULL`,{pluck:!0}).all();return new Set(t)}t.ct();function Ya(e){let[n,r]=t.mt`
    SELECT aci
    FROM key_transparency_account_data
  `;return e.prepare(n,{pluck:!0}).all(r)}function Xa(e,n){let[r,i]=t.mt`
    SELECT data
    FROM key_transparency_account_data
    WHERE aci IS ${n}
  `;return e.prepare(r,{pluck:!0}).get(i)}function Za(e,n,r){let[i,a]=t.mt`
    INSERT OR REPLACE INTO key_transparency_account_data
      (aci, data)
    VALUES
      (${n}, ${r});
  `;e.prepare(i).run(a)}function Qa(e){e.exec(`
    DELETE FROM key_transparency_account_data;
  `)}i.vn(),i.j(),i.l(),t.qr();const $a=new class e{#e;constructor(e){this.#e=e}fatal(...e){this.#t(`fatal`,e)}error(...e){this.#t(`error`,e)}warn(...e){this.#t(`warn`,e)}info(...e){this.#t(`info`,e)}debug(...e){this.#t(`debug`,e)}trace(...e){this.#t(`trace`,e)}child(t){return new e(`${this.#e}[${t}] `)}#t(e,n){if(u.parentPort){let[t,...r]=n,i={type:`log`,level:e,args:[this.#e+t].concat(r)};u.parentPort.postMessage(i)}else t.Yr(!1,`must be test environment`),_[e](this.#e+(0,l.format)(...n))}}(``);t.bi(),t.d(),t.B(),t.nn();const F=t.Vi().optional().transform(t.l).catch(null),I=t.Li().optional().transform(t.l).catch(null),eo=t.Hi([t.Fi(1),t.Fi(2)]).optional().transform(t.l).catch(null),L=t.Hi([t.Fi(0),t.Fi(1)]).optional().transform(t.l).catch(null),to=t.Ri({messageId:t.Vi(),messageType:t.Vi(),editHistoryIndex:t.Li(),attachmentType:t.V,orderInMessage:t.Li(),conversationId:t.Vi(),sentAt:t.Li().catch(0),receivedAt:t.Li().catch(0),size:t.Li().catch(0),contentType:t.Vi().catch(t.Ut),receivedAtMs:I,duration:I,path:F,clientUuid:F,localKey:F,plaintextHash:F,caption:F,blurHash:F,height:I,width:I,digest:F,key:F,fileName:F,downloadPath:F,transitCdnKey:F,transitCdnNumber:I,transitCdnUploadTimestamp:I,backupCdnNumber:I,incrementalMac:F,incrementalMacChunkSize:I,thumbnailPath:F,thumbnailSize:I,thumbnailContentType:F,thumbnailLocalKey:F,thumbnailVersion:eo,screenshotPath:F,screenshotSize:I,screenshotContentType:F,screenshotLocalKey:F,screenshotVersion:eo,backupThumbnailPath:F,backupThumbnailSize:I,backupThumbnailContentType:F,backupThumbnailLocalKey:F,backupThumbnailVersion:eo,storyTextAttachmentJson:F,localBackupPath:F,flags:I,error:L,wasTooBig:L,backfillError:L,isCorrupted:L,isViewOnce:L,copiedFromQuotedAttachment:L,version:eo,pending:L});t.n(),i.f(),t.hi(),t.ct();let R;(function(e){let n=null,r=0,i=!1,a=!1,o=null;function s(e){n=e}e.setOnCheckpointNeeded=s;function c(){n=null,o!=null&&(clearTimeout(o),o=null),r=0,i=!1,a=!1}e._reset=c;function l(e,n,r,i,a){try{e.pragma(`wal_checkpoint(TRUNCATE)`),a()}catch(o){if(o.code!==`SQLITE_LOCKED`){n.error(`WalCheckpoints.run: Unexpected error (attempts: ${r}, reason: ${i})`,t._i(o));return}n.warn(`WalCheckpoints.run: Database is locked, retrying (attempts: ${r}, reason: ${i})`,t._i(o)),setTimeout(()=>{l(e,n,r+1,i,a)},1e3)}}function u(e,t,n){o!=null&&(clearTimeout(o),o=null),l(e,t,0,n,()=>{r=Date.now(),i=!1,a=!1})}e.runImmediately=u;function d(e,t){if(n==null){e.error(`WalCheckpoints.runWhenIdle: setOnCheckpointNeeded has not been called`);return}i||(i=!0,n(t))}function f(e,t){if(i)return;let n=a,s=e===`delete`;e===`delete`&&(a=!0);let c=Date.now()-r,l=a?5e3:3e4;if(c>=l){o!=null&&(clearTimeout(o),o=null),d(t,e);return}if(o!=null){if(n||!s)return;clearTimeout(o)}o=setTimeout(()=>{o=null,d(t,e)},l-c)}e._scheduleRun=f;function p(e,t){e.setWalHook((e,n)=>{n>=1e3?d(t,`page-threshold`):f(`commit`,t)})}e.setupCommitHook=p;function m(e){let[n,r]=t.mt`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE 'messages_fts_%'
        AND sql NOT LIKE 'CREATE VIRTUAL TABLE%'
    `;return e.prepare(n,{pluck:!0}).all(r)}function h(e,t){e.createFunction(`_wal_checkpoint_on_delete`,()=>{f(`delete`,t)});let n=m(e);for(let t of n)e.exec(`
        CREATE TEMP TRIGGER IF NOT EXISTS _wal_checkpoint_${t}_after_delete
        AFTER DELETE ON "${t}"
        BEGIN
          SELECT _wal_checkpoint_on_delete();
        END;
      `)}e.setupDeleteTriggers=h})(R||={}),t.bi(),i.Q(),i.Or(),t.hi(),t.qr(),n.f(),t.d(),t.ai(),t.ct(),t.s(),i.O(),t.B(),i.vt(),t.Xr(),t.J();const{forEach:no,fromPairs:ro,groupBy:io,isBoolean:ao,isNil:oo,isNumber:z,isString:so,last:co,map:lo,mapValues:uo,noop:fo,omit:B,partition:po,pick:mo,sortBy:ho}=m.default,go=[`messageId`,`attachmentType`,`attachmentSignature`,`receivedAt`,`sentAt`,`contentType`,`size`,`active`,`attempts`,`retryAfter`,`lastAttemptTimestamp`,`attachmentJson`,`ciphertextSize`,`originalSource`,`source`],_o={close:ko,getIdentityKeyById:Fo,getAllIdentityKeys:zo,getKyberPreKeyById:Vo,getAllKyberPreKeys:qo,getPreKeyById:Yo,getAllPreKeys:es,getSignedPreKeyById:rs,getAllSignedPreKeys:cs,getItemById:ds,getAllItems:fs,getSenderKeyById:gs,getAllSenderKeys:vs,getAllSentProtos:Ds,_getAllSentProtoRecipients:Os,_getAllSentProtoMessageIds:ks,getAllSessions:Rs,getAllKyberTriples:zs,getConversationCount:Bs,getConversationById:Js,getAllConversations:Ys,getAllConversationIds:Xs,getGroupSendCombinedEndorsementExpiration:na,getGroupSendEndorsementsData:ra,getGroupSendMemberEndorsement:ia,searchMessages:Zs,getMessageCount:$s,getStoryCount:Qs,getRecentStoryReplies:Hc,countStoryReadsByConversation:Sd,getReactionByTimestamp:Lc,_getAllReactions:Bc,getMessageByAuthorAciAndSentAt:Ac,getMessageById:Tc,getMessagesById:Ec,_getAllMessages:Dc,_getAllEditedMessages:cf,getAllMessageIds:kc,getMessagesBySentAt:ql,getExpiredMessages:Jl,getMessagesUnexpectedlyMissingExpirationStartTimestamp:Yl,getSoonestMessageExpiry:Xl,getNextTapToViewMessageTimestampToAgeOut:Zl,getTapToViewMessagesNeedingErase:Ql,getOlderMessagesByConversation:Wc,getAllStories:Gc,getNewerMessagesByConversation:Kc,getOldestUnreadMentionOfMeForConversation:nl,getTotalUnreadForConversation:rl,getTotalUnreadMentionsOfMeForConversation:il,getMessageMetricsForConversation:ol,getConversationRangeCenteredOnMessage:sl,getConversationMessageStats:$c,getLastConversationMessage:el,getAllCallHistory:cl,getCallHistoryUnreadCount:Cl,getCallHistoryMessageByCallId:pl,getCallHistory:ml,getCallHistoryGroupsCount:Ml,getCallHistoryGroups:Fl,hasGroupCallHistoryMessage:Ll,hasMedia:Rl,getSortedMedia:Bl,getSortedNonAttachmentMedia:Vl,getSortedDocuments:Hl,getAllNotificationProfiles:Td,getNotificationProfileById:Ed,getAllDonationReceipts:Ki,getDonationReceiptById:qi,getAllChatFolders:sa,getCurrentChatFolders:ca,getChatFolder:la,hasAllChatsChatFolder:fa,getOldestDeletedChatFolder:Sa,getAllMegaphones:za,getAllMegaphoneIds:Ba,hasMegaphone:Ra,getAllKTAcis:Ya,getKTAccountData:Xa,getAllPinnedMessages:Ea,getPinnedMessagesPreloadDataForConversation:Da,getNextExpiringPinnedMessageAcrossConversations:Pa,callLinkExists:xi,defunctCallLinkExists:Hi,getAllCallLinks:wi,getCallLinkByRoomId:Si,getCallLinkRecordByRoomId:Ci,getAllAdminCallLinks:Ri,getAllCallLinkRecordsWithAdminKey:Li,getAllDefunctCallLinksWithAdminKey:Ui,getAllMarkedDeletedCallLinkRoomIds:zi,getMessagesBetween:Yc,getNearbyMessageFromDeletedSet:Xc,getMostRecentAddressableMessages:tc,getMostRecentAddressableNondisappearingMessages:nc,getUnprocessedCount:eu,_getAttachmentDownloadJob:ou,getStickerCount:Lu,getAllStickerPacks:Ru,getInstalledStickerPacks:Uu,getUninstalledStickerPacks:Hu,getStickerPackInfo:Wu,getAllStickers:qu,getRecentStickers:Ju,getRecentEmojis:Xu,getRecentGifs:Qu,getAllBadges:td,getAllBadgeImageFileLocalPaths:id,getAllMegaphoneImageLocalPaths:Ja,getAllStoryDistributionsWithMembers:fd,getStoryDistributionWithMembers:pd,_getAllStoryDistributions:cd,_getAllStoryDistributionMembers:ld,_getAllStoryReads:vd,getLastStoryReadsForAuthor:xd,getMessagesNeedingUpgrade:Fd,getMessageServerGuidsForSpam:Ld,getJobsInQueue:Yd,wasGroupCallRingPreviouslyCanceled:Zd,getMaxMessageCounter:tf,getStatisticsForLogging:nf,getMostRecentAttachmentUploadData:_c,getBackupCdnObjectMetadata:wu,getBackupAttachmentDownloadProgress:lu,getAttachmentReferencesForMessages:mi,getMessageCountBySchemaVersion:uf,getMessageSampleForSchemaVersion:df,isAttachmentSafeToDelete:gc,getAllProtectedAttachmentPaths:hc,getKnownMessageAttachments:Bd,finishGetKnownMessageAttachments:Vd,pageMessages:Hd,finishPageMessages:Ud,pageBackupMessages:Wd,getKnownDownloads:Gd,getKnownConversationAttachments:Kd,__dangerouslyRunAbitraryReadOnlySqlQuery:bf},vo={close:Ao,removeIndexedDBFiles:Mo,createOrUpdateIdentityKey:Po,bulkAddIdentityKeys:Io,removeIdentityKeyById:Lo,removeAllIdentityKeys:Ro,createOrUpdateKyberPreKey:Bo,bulkAddKyberPreKeys:Ho,removeKyberPreKeyById:Uo,removeKyberPreKeysByServiceId:Wo,removeAllKyberPreKeys:Ko,createOrUpdatePreKey:Jo,bulkAddPreKeys:Xo,removePreKeyById:Zo,removePreKeysByServiceId:Qo,removeAllPreKeys:$o,createOrUpdateSignedPreKey:ns,bulkAddSignedPreKeys:is,removeSignedPreKeyById:as,removeSignedPreKeysByServiceId:os,removeAllSignedPreKeys:ss,createOrUpdateItem:us,removeItemById:ps,removeAllItems:ms,createOrUpdateSenderKey:hs,removeAllSenderKeys:_s,removeSenderKeyById:ys,insertSentProto:bs,deleteSentProtosOlderThan:xs,deleteSentProtoByMessageId:Ss,insertProtoRecipients:Cs,deleteSentProtoRecipient:ws,removeAllSentProtos:Es,getSentProtoByRecipient:Ts,createOrUpdateSession:js,createOrUpdateSessions:Ms,commitDecryptResult:Ns,removeSessionById:Ps,removeSessionsByConversation:Fs,removeSessionsByServiceId:Is,removeAllSessions:Ls,saveConversation:Hs,saveConversations:Us,updateConversation:Ws,updateConversations:Gs,_removeConversation:Ks,_removeAllConversations:qs,updateAllConversationColors:rf,removeAllProfileKeyCredentials:af,getUnreadByConversationAndMarkRead:Mc,getUnreadReactionsAndMarkRead:Nc,getUnreadPollVotesAndMarkRead:Fc,replaceAllEndorsementsForGroup:Zi,deleteAllEndorsementsForGroup:ta,saveMessage:yc,saveMessages:bc,saveMessagesIndividually:xc,removeMessage:Sc,removeMessages:wc,markReactionAsRead:Pc,markPollVoteAsRead:Ic,addReaction:Rc,removeReactionFromConversation:zc,_removeAllReactions:Vc,_removeAllMessages:Oc,_removeMessage:Sc,getUnreadEditedMessagesAndMarkRead:lf,clearCallHistory:ul,_removeAllCallHistory:ll,markCallHistoryDeleted:dl,cleanupCallHistoryMessages:fl,markCallHistoryRead:wl,markAllCallHistoryRead:Ol,markAllCallHistoryReadInConversation:kl,saveCallHistory:Il,markCallHistoryMissed:Wl,insertCallLink:Ei,insertOrUpdateCallLinkFromSync:Di,updateCallLink:Oi,updateCallLinkState:ki,beginDeleteAllCallLinks:Ii,beginDeleteCallLink:Pi,deleteCallHistoryByRoomId:Mi,deleteCallLinkAndHistory:Fi,finalizeDeleteCallLink:Bi,_removeAllCallLinks:Vi,deleteCallLinkFromSync:Ni,insertDefunctCallLink:Wi,updateDefunctCallLink:Gi,migrateConversationMessages:Kl,saveEditedMessage:sf,saveEditedMessages:of,incrementMessagesMigrationAttempts:Id,removeSyncTaskById:rc,removeSyncTasks:ac,saveSyncTasks:oc,incrementAllSyncTaskAttempts:cc,dequeueOldestSyncTasks:lc,getUnprocessedByIdsAndIncrementAttempts:nu,getAllUnprocessedIds:tu,removeUnprocessed:iu,removeAllUnprocessed:au,getNextAttachmentDownloadJobs:uu,saveAttachmentDownloadJob:fu,saveAttachmentDownloadJobs:du,resetAttachmentDownloadActive:pu,resetBackupAttachmentDownloadJobsRetryAfter:mu,removeAttachmentDownloadJob:hu,removeAttachmentDownloadJobsForMessage:gu,removeAllBackupAttachmentDownloadJobs:su,resetBackupAttachmentDownloadStats:cu,getAndProtectExistingAttachmentPath:fc,_protectAttachmentPathFromDeletion:pc,resetProtectedAttachmentPaths:mc,getNextAttachmentBackupJobs:bu,saveAttachmentBackupJob:yu,markAllAttachmentBackupJobsInactive:vu,removeAttachmentBackupJob:xu,clearAllAttachmentBackupJobs:_u,clearAllBackupCdnObjectMetadata:Su,saveBackupCdnObjectMetadata:Cu,createOrUpdateStickerPack:Tu,createOrUpdateStickerPacks:Eu,updateStickerPackStatus:Du,updateStickerPackInfo:Ou,createOrUpdateSticker:Au,createOrUpdateStickers:ju,updateStickerLastUsed:Mu,addStickerPackReference:Nu,deleteStickerPackReference:Pu,deleteStickerPack:Iu,getUnresolvedStickerPackReferences:Fu,addUninstalledStickerPack:zu,addUninstalledStickerPacks:Bu,installStickerPack:Gu,uninstallStickerPack:Ku,clearAllErrorStickerPackAttempts:ku,updateEmojiUsage:Yu,addRecentGif:$u,removeRecentGif:ed,updateOrCreateBadges:nd,badgeImageFileDownloaded:rd,getRecentStaleRingsAndMarkOlderMissed:Gl,_deleteAllStoryDistributions:ud,createNewStoryDistribution:dd,modifyStoryDistribution:md,modifyStoryDistributionMembers:hd,modifyStoryDistributionWithMembers:gd,deleteStoryDistribution:_d,_deleteAllStoryReads:yd,addNewStoryRead:bd,_deleteAllNotificationProfiles:Dd,createNotificationProfile:Ad,deleteNotificationProfileById:Od,markNotificationProfileDeleted:kd,updateNotificationProfile:jd,_deleteAllDonationReceipts:Ji,deleteDonationReceiptById:Yi,createDonationReceipt:Xi,createChatFolder:da,createAllChatsChatFolder:pa,upsertAllChatsChatFolderFromSync:ma,updateChatFolder:ha,updateChatFolderToggleChat:ga,updateChatFolderPositions:ba,updateChatFolderDeletedAtTimestampMsFromSync:xa,markChatFolderDeleted:va,deleteExpiredChatFolders:Ca,createMegaphone:Ha,updateMegaphone:Ua,deleteMegaphone:Ka,finishMegaphone:Wa,snoozeMegaphone:Ga,internalDeleteAllMegaphones:qa,setKTAccountData:Za,removeAllKTAccountData:Qa,appendPinnedMessage:Ma,deletePinnedMessageByMessageId:Na,deleteAllExpiredPinnedMessagesBefore:Fa,removeAll:Md,removeAllConfiguration:Nd,eraseStorageServiceState:Pd,insertJob:X,deleteJob:Xd,processGroupCallRingCancellation:Qd,cleanExpiredGroupCallRingCancellations:ef,disableMessageInsertTriggers:ff,enableMessageInsertTriggersAndBackfill:gf,ensureMessageInsertTriggersAreEnabled:yf,disableFSync:mf,enableFSyncAndCheckpoint:hf,_testOnlyRemoveMessageAttachments:vc,removeKnownStickers:qd,removeKnownDraftAttachments:Jd,runCorruptionChecks:ad};function yo(e){let{expireTimerVersion:n}=e,r=JSON.parse(e.json),a;return i.Xn(e.profileLastFetchedAt)?a=e.profileLastFetchedAt:(t.Kr(oo(e.profileLastFetchedAt),`profileLastFetchedAt contained invalid data; defaulting to undefined`),a=void 0),{...r,expireTimerVersion:n,profileLastFetchedAt:a}}function bo(e){return{...e,isCoverOnly:!!e.isCoverOnly,emoji:e.emoji==null?void 0:t.t.unsafeCastMaybeInvalidStringToVariant(e.emoji),version:e.version||1,localKey:t.u(e.localKey),size:t.u(e.size)}}function xo(e,t){e.pragma(`key = "x'${t}'"`)}function So(e){e.pragma(`journal_mode = WAL`),e.pragma(`synchronous = FULL`),R.setupCommitHook(e,V)}function Co(e){if(t.st(e)>0)return;let n=t.ot(e),r=n>18?16:n;V.info(`migrateSchemaVersion: Migrating from schema_version ${n} to user_version ${r}`),t.pt(e,r)}function wo(e,t){let n;try{return n=new p.default(e,{cacheStatements:!0}),xo(n,t),So(n),Co(n),n}catch{n&&n.close(),V.info(`migrateDatabase: Migration without cipher change failed`)}n=new p.default(e);try{xo(n,t),n.pragma(`cipher_compatibility = 3`),Co(n),n.close(),n=new p.default(e),xo(n,t),n.pragma(`cipher_migrate`),So(n)}catch(e){try{n.close()}catch{}throw e}return n}const To=/[^0-9A-Fa-f]/;function Eo(e,{key:n}){if(To.exec(n))throw Error(`setupSQLCipher: key '${n}' is not valid`);let r=wo(e,n);try{r.pragma(`foreign_keys = ON`)}catch(e){try{r.close()}catch{}throw e}try{r.pragma(`fullfsync = false`),r.pragma(`checkpoint_fullfsync = true`)}catch(e){V.warn(`openAndSetUpSQLCipher: Unable to set fullfsync`,t._i(e))}return r.initTokenizer(),r}let V=$a,H,Do;(0,p.setLogger)((e,t)=>{if(e!==`SQLITE_SCHEMA`){if(e===`SQLITE_NOTICE`){V.info(`sqlite(${e}): ${t}`);return}V.warn(`sqlite(${e}): ${t}`)}});function Oo({configDir:e,key:t,isPrimary:n}){if(!so(e))throw Error(`initialize: configDir is required!`);if(!so(t))throw Error(`initialize: key is required!`);Do=(0,a.join)(e,`IndexedDB`);let r=(0,a.join)(e,`sql`);(0,s.mkdirSync)(r,{recursive:!0}),H=(0,a.join)(r,`db.sqlite`);let i;try{return i=Eo(H,{key:t}),n&&(li(i,V),R.setupDeleteTriggers(i,V)),$s(i),i}catch(e){throw V.error(`Database startup error:`,e.stack),i?.close(),e}}function ko(e){e.close()}function Ao(e){R.runImmediately(e,V,`close`),e.pragma(`optimize`),e.close()}function jo(){if(!H)throw Error(`removeDB: Cannot erase database without a databaseFilePath!`);V.warn(`removeDB: Removing all database files`),(0,s.rmSync)(H,{recursive:!0,force:!0}),(0,s.rmSync)(`${H}-shm`,{recursive:!0,force:!0}),(0,s.rmSync)(`${H}-wal`,{recursive:!0,force:!0})}function Mo(e){if(!Do)throw Error(`removeIndexedDBFiles: Need to initialize and set indexedDBPath first!`);(0,s.rmSync)((0,a.join)(Do,`*.leveldb`),{recursive:!0,force:!0}),Do=void 0}function No(e,t){return e}const U=`identityKeys`;function Po(e,n){return t.et(e,U,n)}function Fo(e,n){return t.nt(e,U,n)}function Io(e,n){return t.Z(e,U,n)}function Lo(e,n){return t.ft(e,U,n)}function Ro(e){return t.dt(e,U)}function zo(e){return t.tt(e,U)}const W=`kyberPreKeys`;function Bo(e,n){return t.et(e,W,n)}function Vo(e,n){return t.nt(e,W,n)}function Ho(e,n){return t.Z(e,W,n)}function Uo(e,n){return t.ft(e,W,n)}function Wo(e,t){e.prepare(`DELETE FROM kyberPreKeys WHERE ourServiceId IS $serviceId;`).run({serviceId:t})}function Go(e,{id:n,signedPreKeyId:r,baseKey:i}){let[a,o]=t.mt`
    INSERT OR FAIL INTO kyberPreKey_triples
      (id, signedPreKeyId, baseKey)
    VALUES
      (${n}, ${r}, ${i});
  `;try{e.prepare(a).run(o)}catch(e){throw e.code===`SQLITE_CONSTRAINT_UNIQUE`?Error(`Duplicate kyber triple ${n}:${r}`):e}}function Ko(e){return t.dt(e,W)}function qo(e){return t.tt(e,W)}const G=`preKeys`;function Jo(e,n){return t.et(e,G,n)}function Yo(e,n){return t.nt(e,G,n)}function Xo(e,n){return t.Z(e,G,n)}function Zo(e,n){return t.ft(e,G,n)}function Qo(e,t){e.prepare(`DELETE FROM preKeys WHERE ourServiceId IS $serviceId;`).run({serviceId:t})}function $o(e){return t.dt(e,G)}function es(e){return t.tt(e,G)}const ts=`signedPreKeys`;function ns(e,n){return t.et(e,ts,n)}function rs(e,n){return t.nt(e,ts,n)}function is(e,n){return t.Z(e,ts,n)}function as(e,n){return t.ft(e,ts,n)}function os(e,t){e.prepare(`DELETE FROM signedPreKeys WHERE ourServiceId IS $serviceId;`).run({serviceId:t})}function ss(e){return t.dt(e,ts)}function cs(e){return e.prepare(`
      SELECT json
      FROM signedPreKeys
      ORDER BY id ASC;
      `).all().map(e=>t.lt(e.json))}const ls=`items`;function us(e,n){return t.et(e,ls,n)}function ds(e,n){return t.nt(e,ls,n)}function fs(e){let n=e.prepare(`SELECT json FROM items ORDER BY id ASC;`).all().map(e=>t.lt(e.json)),r=Object.create(null);for(let{id:e,value:t}of n)r[e]=t;return r}function ps(e,n){return t.ft(e,ls,n)}function ms(e){return t.dt(e,ls)}function hs(e,t){e.prepare(`
    INSERT OR REPLACE INTO senderKeys (
      id,
      senderId,
      distributionId,
      data,
      lastUpdatedDate
    ) values (
      $id,
      $senderId,
      $distributionId,
      $data,
      $lastUpdatedDate
    )
    `).run(t)}function gs(e,t){return e.prepare(`SELECT * FROM senderKeys WHERE id = $id`).get({id:t})}function _s(e){e.prepare(`DELETE FROM senderKeys`).run()}function vs(e){return e.prepare(`SELECT * FROM senderKeys`).all()}function ys(e,t){e.prepare(`DELETE FROM senderKeys WHERE id = $id`).run({id:t})}function bs(e,n,r){let{recipients:a,messageIds:o}=r;return e.transaction(()=>{let r=t.h(e.prepare(`
      INSERT INTO sendLogPayloads (
        contentHint,
        proto,
        timestamp,
        urgent,
        hasPniSignatureMessage
      ) VALUES (
        $contentHint,
        $proto,
        $timestamp,
        $urgent,
        $hasPniSignatureMessage
      );
      `).run({...n,urgent:+!!n.urgent,hasPniSignatureMessage:+!!n.hasPniSignatureMessage}).lastInsertRowid,`insertSentProto/lastInsertRowid`),s=e.prepare(`
      INSERT INTO sendLogRecipients (
        payloadId,
        recipientServiceId,
        deviceId
      ) VALUES (
        $id,
        $recipientServiceId,
        $deviceId
      );
      `);for(let[e,n]of Object.entries(a)){t.Yr(i.Ar(e),`Recipient must be a service id`);for(let t of n)s.run({id:r,recipientServiceId:e,deviceId:t})}let c=e.prepare(`
      INSERT INTO sendLogMessageIds (
        payloadId,
        messageId
      ) VALUES (
        $id,
        $messageId
      );
      `);for(let e of new Set(o))c.run({id:r,messageId:e});return r})()}function xs(e,t){e.prepare(`
    DELETE FROM sendLogPayloads
    WHERE
      timestamp IS NULL OR
      timestamp < $timestamp;
    `).run({timestamp:t})}function Ss(e,t){e.prepare(`
    DELETE FROM sendLogPayloads WHERE id IN (
      SELECT payloadId FROM sendLogMessageIds
      WHERE messageId = $messageId
    );
    `).run({messageId:t})}function Cs(e,{id:t,recipientServiceId:n,deviceIds:r}){e.transaction(()=>{let i=e.prepare(`
      INSERT INTO sendLogRecipients (
        payloadId,
        recipientServiceId,
        deviceId
      ) VALUES (
        $id,
        $recipientServiceId,
        $deviceId
      );
      `);for(let e of r)i.run({id:t,recipientServiceId:n,deviceId:e})})()}function ws(e,n){let r=Array.isArray(n)?n:[n];return e.transaction(()=>{let n=[];for(let i of r){let{timestamp:r,recipientServiceId:a,deviceId:o}=i,[s,...c]=e.prepare(`
        SELECT sendLogPayloads.id, sendLogPayloads.hasPniSignatureMessage
        FROM sendLogPayloads
        INNER JOIN sendLogRecipients
          ON sendLogRecipients.payloadId = sendLogPayloads.id
        WHERE
          sendLogPayloads.timestamp = $timestamp AND
          sendLogRecipients.recipientServiceId = $recipientServiceId AND
          sendLogRecipients.deviceId = $deviceId;
       `).all({timestamp:r,recipientServiceId:a,deviceId:o});if(s==null)continue;c.length>0&&V.warn(`deleteSentProtoRecipient: More than one payload matches recipient and timestamp ${r}. Using the first.`);let{id:l,hasPniSignatureMessage:u}=s;e.prepare(`
        DELETE FROM sendLogRecipients
        WHERE
          payloadId = $id AND
          recipientServiceId = $recipientServiceId AND
          deviceId = $deviceId;
        `).run({id:l,recipientServiceId:a,deviceId:o});let d=e.prepare(`
        SELECT count(1) FROM sendLogRecipients
        WHERE payloadId = $id AND recipientServiceId = $recipientServiceId;
        `,{pluck:!0}).get({id:l,recipientServiceId:a})??0;d===0&&u&&(V.info(`deleteSentProtoRecipient: Successfully shared phone number with ${a} through message ${r}`),n.push(a)),t.Yr(z(d),`deleteSentProtoRecipient: select count() returned non-number!`);let f=e.prepare(`SELECT count(1) FROM sendLogRecipients WHERE payloadId = $id;`,{pluck:!0}).get({id:l});t.Yr(z(f),`deleteSentProtoRecipient: select count() returned non-number!`),!(f>0)&&(V.info(`deleteSentProtoRecipient: Deleting proto payload for timestamp ${r}`),e.prepare(`DELETE FROM sendLogPayloads WHERE id = $id;`).run({id:l}))}return{successfulPhoneNumberShares:n}})()}function Ts(e,{now:t,recipientServiceId:n,timestamp:r}){xs(e,t-1e3*60*60*24);let i=e.prepare(`
    SELECT
      sendLogPayloads.*,
      GROUP_CONCAT(DISTINCT sendLogMessageIds.messageId) AS messageIds
    FROM sendLogPayloads
    INNER JOIN sendLogRecipients ON sendLogRecipients.payloadId = sendLogPayloads.id
    LEFT JOIN sendLogMessageIds ON sendLogMessageIds.payloadId = sendLogPayloads.id
    WHERE
      sendLogPayloads.timestamp = $timestamp AND
      sendLogRecipients.recipientServiceId = $recipientServiceId
    GROUP BY sendLogPayloads.id;
    `).get({timestamp:r,recipientServiceId:n});if(!i)return;let{messageIds:a}=i;return{...i,urgent:z(i.urgent)?!!i.urgent:!0,hasPniSignatureMessage:z(i.hasPniSignatureMessage)?!!i.hasPniSignatureMessage:!0,messageIds:a?a.split(`,`):[]}}function Es(e){e.prepare(`DELETE FROM sendLogPayloads;`).run()}function Ds(e){return e.prepare(`SELECT * FROM sendLogPayloads;`).all().map(e=>({...e,urgent:z(e.urgent)?!!e.urgent:!0,hasPniSignatureMessage:z(e.hasPniSignatureMessage)?!!e.hasPniSignatureMessage:!0}))}function Os(e){return e.prepare(`SELECT * FROM sendLogRecipients;`).all()}function ks(e){return e.prepare(`SELECT * FROM sendLogMessageIds;`).all()}const As=`sessions`;function js(e,t){let{id:n,conversationId:r,ourServiceId:i,serviceId:a,deviceId:o,record:s}=t;if(!n)throw Error(`createOrUpdateSession: Provided data did not have a truthy id`);if(!r)throw Error(`createOrUpdateSession: Provided data did not have a truthy conversationId`);e.prepare(`
    INSERT OR REPLACE INTO sessions (
      id,
      conversationId,
      ourServiceId,
      serviceId,
      deviceId,
      record
    ) values (
      $id,
      $conversationId,
      $ourServiceId,
      $serviceId,
      $deviceId,
      $record
    )
    `).run({id:n,conversationId:r,ourServiceId:i,serviceId:a,deviceId:o,record:s})}function Ms(e,t){e.transaction(()=>{for(let n of t)js(e,n)})()}function Ns(e,{kyberPreKeysToRemove:t,preKeysToRemove:n,senderKeys:r,sessions:i,unprocessed:a,kyberTriples:o}){e.transaction(()=>{if(t.length>0){let n=Uo(e,t);n===t.length?V.info(`commitDecryptResult: Removed ${n} kyberPreKeys`):V.error(`commitDecryptResult: Changed ${n} keys, but had ${t.length} kyberPreKeys to remove`)}if(n.length>0){let t=Zo(e,n);t===n.length?V.info(`commitDecryptResult: Removed ${t} preKeys`):V.error(`commitDecryptResult: Changed ${t} keys, but had ${n.length} preKeys to remove`)}for(let t of r)hs(e,t);for(let t of i)js(e,t);for(let t of a)$l(e,t);for(let t of o)Go(e,t)})()}function Ps(e,n){return t.ft(e,As,n)}function Fs(e,t){e.prepare(`
    DELETE FROM sessions
    WHERE conversationId = $conversationId;
    `).run({conversationId:t})}function Is(e,t){e.prepare(`
    DELETE FROM sessions
    WHERE serviceId = $serviceId;
    `).run({serviceId:t})}function Ls(e){return t.dt(e,As)}function Rs(e){return e.prepare(`SELECT * FROM sessions`).all()}function zs(e){return e.prepare(`SELECT * FROM kyberPreKey_triples`).all()}function Bs(e){return t.rt(e,`conversations`)}function Vs({members:e,membersV2:t}){return t?t.map(e=>e.aci).join(` `):e?e.join(` `):null}function Hs(e,n){let{active_at:r,e164:a,groupId:o,id:s,name:c,profileFamilyName:l,profileName:u,profileLastFetchedAt:d,type:f,serviceId:p,expireTimerVersion:m}=n,h=Vs(n);e.prepare(`
    INSERT INTO conversations (
      id,
      json,

      e164,
      serviceId,
      groupId,

      active_at,
      type,
      members,
      name,
      profileName,
      profileFamilyName,
      profileFullName,
      profileLastFetchedAt,
      expireTimerVersion
    ) values (
      $id,
      $json,

      $e164,
      $serviceId,
      $groupId,

      $active_at,
      $type,
      $members,
      $name,
      $profileName,
      $profileFamilyName,
      $profileFullName,
      $profileLastFetchedAt,
      $expireTimerVersion
    );
    `).run({id:s,json:t.ut(B(n,[`profileLastFetchedAt`,`expireTimerVersion`])),e164:a||null,serviceId:p||null,groupId:o||null,active_at:r||null,type:f,members:h,name:c||null,profileName:u||null,profileFamilyName:l||null,profileFullName:i.r(u,l)||null,profileLastFetchedAt:d||null,expireTimerVersion:m})}function Us(e,t){e.transaction(()=>{for(let n of t)Hs(e,n)})()}function Ws(e,n){let{id:r,active_at:a,type:o,name:s,profileName:c,profileFamilyName:l,profileLastFetchedAt:u,e164:d,serviceId:f,expireTimerVersion:p}=n,m=Vs(n);e.prepare(`
    UPDATE conversations SET
      json = $json,

      e164 = $e164,
      serviceId = $serviceId,

      active_at = $active_at,
      type = $type,
      members = $members,
      name = $name,
      profileName = $profileName,
      profileFamilyName = $profileFamilyName,
      profileFullName = $profileFullName,
      profileLastFetchedAt = $profileLastFetchedAt,
      expireTimerVersion = $expireTimerVersion
    WHERE id = $id;
    `).run({id:r,json:t.ut(B(n,[`profileLastFetchedAt`])),e164:d||null,serviceId:f||null,active_at:a||null,type:o,members:m,name:s||null,profileName:c||null,profileFamilyName:l||null,profileFullName:i.r(c,l)||null,profileLastFetchedAt:u||null,expireTimerVersion:p})}function Gs(e,t){e.transaction(()=>{for(let n of t)Ws(e,n)})()}function Ks(e,t){e.prepare(`DELETE FROM conversations WHERE id = $id;`).run({id:t})}function qs(e){e.prepare(`DELETE from conversations;`).run()}function Js(e,t){let n=e.prepare(`
      SELECT json, profileLastFetchedAt, expireTimerVersion
      FROM conversations
      WHERE id = $id
      `).get({id:t});if(n)return yo(n)}function Ys(e){return e.prepare(`
      SELECT json, profileLastFetchedAt, expireTimerVersion
      FROM conversations
      ORDER BY id ASC;
      `).all().map(e=>yo(e))}function Xs(e){return e.prepare(`
      SELECT id FROM conversations ORDER BY id ASC;
      `).all().map(e=>e.id)}function Zs(e,{query:n,options:r,conversationId:a,contactServiceIdsMatchingQuery:o}){let{limit:s=a?100:500}=r??{},c=No(e,`only temp table use`),l=c.signalTokenize(n).map(e=>`"${e.replace(/"/g,`""`)}"*`).join(` `);return l?c.transaction(()=>{c.exec(`
      CREATE TEMP TABLE tmp_results(rowid INTEGER PRIMARY KEY ASC);
      CREATE TEMP TABLE tmp_filtered_results(rowid INTEGER PRIMARY KEY ASC);
      `),c.prepare(`
        INSERT INTO tmp_results (rowid)
        SELECT
          rowid
        FROM
          messages_fts
        WHERE
          messages_fts.body MATCH $query;
      `).run({query:l}),a===void 0?c.prepare(`
          INSERT INTO tmp_filtered_results (rowid)
          SELECT
            tmp_results.rowid
          FROM
            tmp_results
          INNER JOIN
            messages ON messages.rowid = tmp_results.rowid
          ORDER BY messages.received_at DESC, messages.sent_at DESC
          LIMIT $limit;
        `).run({limit:s}):c.prepare(`
          INSERT INTO tmp_filtered_results (rowid)
          SELECT
            tmp_results.rowid
          FROM
            tmp_results
          INNER JOIN
            messages ON messages.rowid = tmp_results.rowid
          WHERE
            messages.conversationId = $conversationId
          ORDER BY messages.received_at DESC, messages.sent_at DESC
          LIMIT $limit;
        `).run({conversationId:a,limit:s});let n=t.gt`
      SELECT
        messages.rowid,
        ${t.G},
        snippet(messages_fts, -1, ${i.$n}, ${i.er}, ${i.tr}, 10) AS ftsSnippet
      FROM tmp_filtered_results
      INNER JOIN messages_fts
        ON messages_fts.rowid = tmp_filtered_results.rowid
      INNER JOIN messages
        ON messages.rowid = tmp_filtered_results.rowid
      WHERE
        messages_fts.body MATCH ${l}
      ORDER BY messages.received_at DESC, messages.sent_at DESC
      LIMIT ${s}
    `,r;if(o?.length){let[e,i]=t.mt`
        SELECT
          messages.rowid as rowid,
          ${t.vt(t.W.map(e=>{let n=t._t(e);return t.gt`
            COALESCE(messages.${n}, ftsResults.${n}) AS ${n}
          `}))},
          ftsResults.ftsSnippet,
          mentionAci,
          start as mentionStart,
          length as mentionLength
        FROM mentions
        INNER JOIN messages
        ON
          messages.id = mentions.messageId
          AND mentions.mentionAci IN (
            ${t.vt(o)}
          )
          AND ${a?t.gt`messages.conversationId = ${a}`:`1 IS 1`}
          AND messages.isViewOnce IS NOT 1
          AND messages.storyId IS NULL
        FULL OUTER JOIN (
          ${n}
        ) as ftsResults
        USING (rowid)
        GROUP BY rowid
        ORDER BY received_at DESC, sent_at DESC
        LIMIT ${s};
        `;r=c.prepare(e).all(i)}else{let[e,i]=t.mt`${n};`;r=c.prepare(e).all(i)}c.exec(`
      DROP TABLE tmp_results;
      DROP TABLE tmp_filtered_results;
      `);let u=N(e,r);return r.map((e,n)=>{let r=u[n];return t.Yr(r,`Missing message`),{...r,ftsSnippet:e.ftsSnippet,mentionAci:e.mentionAci,mentionStart:e.mentionStart,mentionLength:e.mentionLength}})})():[]}function Qs(e,t){return e.prepare(`
    SELECT count(1)
    FROM messages
    WHERE conversationId = $conversationId AND isStory = 1;
    `,{pluck:!0}).get({conversationId:t})??0}function $s(e,n){return n===void 0?t.rt(e,`messages`):e.prepare(`
    SELECT count(1)
    FROM messages
    WHERE conversationId = $conversationId;
    `,{pluck:!0}).get({conversationId:n})??0}function ec(e,t){return e.prepare(`
  SELECT EXISTS(
    SELECT 1 FROM messages
    INDEXED BY message_user_initiated
    WHERE
      conversationId IS $conversationId AND
      isUserInitiatedMessage IS 1
  );
  `,{pluck:!0}).get({conversationId:t})!==0}function tc(e,n,r=5){return e.transaction(()=>{let[i,a]=t.mt`
    SELECT ${t.G}
    FROM messages
    INDEXED BY messages_by_date_addressable
    WHERE
      conversationId IS ${n} AND
      isAddressableMessage = 1
    ORDER BY received_at DESC, sent_at DESC
    LIMIT ${r};
  `;return N(e,e.prepare(i).all(a))})()}function nc(e,n,r=5){return e.transaction(()=>{let[i,a]=t.mt`
    SELECT ${t.G}
    FROM messages
    INDEXED BY messages_by_date_addressable_nondisappearing
    WHERE
      expireTimer IS NULL AND
      conversationId IS ${n} AND
      isAddressableMessage = 1
    ORDER BY received_at DESC, sent_at DESC
    LIMIT ${r};
  `;return N(e,e.prepare(i).all(a))})()}function rc(e,n){let[r,i]=t.mt`
    DELETE FROM syncTasks
    WHERE id IS ${n}
  `;e.prepare(r).run(i)}function ic(e,t,n){e.prepare(`
    DELETE FROM syncTasks
    WHERE id IN ( ${t.map(()=>`?`).join(`, `)} );
    `,{persistent:n}).run(t)}function ac(e,n){t.X(e,n,(t,n)=>ic(e,t,n))}function oc(e,t){return e.transaction(()=>{t.forEach(t=>sc(e,t))})()}function sc(e,n){let{id:r,attempts:i,createdAt:a,data:o,envelopeId:s,sentAt:c,type:l}=n,[u,d]=t.mt`
    INSERT INTO syncTasks (
      id,
      attempts,
      createdAt,
      data,
      envelopeId,
      sentAt,
      type
    ) VALUES (
      ${r},
      ${i},
      ${a},
      ${t.ut(o)},
      ${s},
      ${c},
      ${l}
    )
  `;e.prepare(u).run(d)}function cc(e){let[n,r]=t.mt`
    UPDATE syncTasks
    SET attempts = attempts + 1
  `;return e.transaction(()=>{e.prepare(n).run(r)})()}function lc(e,n){let{previousRowId:r,incrementAttempts:i=!0,syncTaskTypes:a}=n;return e.transaction(()=>{let n=t.gt`ORDER BY rowid ASC`,o=t.gt`LIMIT 10000`,s=t.gt`rowid > ${r??0}`;a&&a.length>0&&(s=t.gt`${s} AND type IN (${t.vt(a)})`);let[c,l]=t.mt`
      DELETE FROM syncTasks
      WHERE
        attempts >= ${5} AND
        createdAt < ${Date.now()-t.It*2}
    `,u=e.prepare(c).run(l);u.changes>0&&V.info(`dequeueOldestSyncTasks: Deleted ${u.changes} expired sync tasks`);let[d,f]=t.mt`
      SELECT rowid, * FROM syncTasks
      WHERE ${s}
      ${n}
      ${o}
    `,p=e.prepare(d).all(f);if(!p.length)return{tasks:[],lastRowId:null};let m=p.at(0)?.rowid,h=p.at(-1)?.rowid;t.Yr(m,`dequeueOldestSyncTasks: firstRowId is null`),t.Yr(h,`dequeueOldestSyncTasks: lastRowId is null`);let g=p.map(e=>{let{rowid:n,...r}=e;return{...r,data:t.lt(e.data)}});if(i){let n=t.gt`rowid >= ${m} AND rowid <= ${h}`;a&&a.length>0&&(n=t.gt`${n} AND type IN (${t.vt(a)})`);let[r,i]=t.mt`
        UPDATE syncTasks
        SET attempts = attempts + 1
        WHERE ${n}
        RETURNING id, attempts;
      `,o=e.prepare(r).all(i);if(Array.isArray(o)){let e=new Map(o.map(({id:e,attempts:t})=>[e,t]));g=g.map(t=>{let{id:n}=t,r=e.get(n)??t.attempts;return{...t,attempts:r}})}else V.error(`dequeueOldestSyncTasks: failed to get sync task attempts`)}return{tasks:g,lastRowId:h}})()}function uc(e,t,{editHistoryIndex:n}){let{id:r,type:i,conversationId:a,sent_at:o,received_at:s,received_at_ms:c,isViewOnce:l}=t,u=t.attachments;if(u)for(let t=0;t<u.length;t+=1){let d=u[t];K({db:e,messageId:r,messageType:i,conversationId:a,sentAt:o,receivedAt:s,receivedAtMs:c,attachmentType:`attachment`,attachment:d,orderInMessage:t,editHistoryIndex:n,isViewOnce:l})}let{bodyAttachment:d}=t;d&&K({db:e,messageId:r,messageType:i,conversationId:a,sentAt:o,receivedAt:s,receivedAtMs:c,attachmentType:`long-message`,attachment:d,orderInMessage:0,editHistoryIndex:n,isViewOnce:l});let f=t.preview?.map(e=>e.image);if(f)for(let t=0;t<f.length;t+=1){let u=f[t];u&&K({db:e,messageId:r,messageType:i,conversationId:a,sentAt:o,receivedAt:s,receivedAtMs:c,attachmentType:`preview`,attachment:u,orderInMessage:t,editHistoryIndex:n,isViewOnce:l})}let p=t.quote?.attachments;if(p)for(let t=0;t<p.length;t+=1){let u=p[t];u?.thumbnail&&K({db:e,messageId:r,messageType:i,conversationId:a,sentAt:o,receivedAt:s,receivedAtMs:c,attachmentType:`quote`,attachment:u.thumbnail,orderInMessage:t,editHistoryIndex:n,isViewOnce:l})}let m=t.contact?.map(e=>e.avatar?.avatar);if(m)for(let t=0;t<m.length;t+=1){let u=m[t];u&&K({db:e,messageId:r,messageType:i,conversationId:a,sentAt:o,receivedAt:s,receivedAtMs:c,attachmentType:`contact`,attachment:u,orderInMessage:t,editHistoryIndex:n,isViewOnce:l})}let h=t.sticker?.data;h&&K({db:e,messageId:r,messageType:i,conversationId:a,sentAt:o,receivedAt:s,receivedAtMs:c,attachmentType:`sticker`,attachment:h,orderInMessage:0,editHistoryIndex:n,isViewOnce:l})}function dc(e,n){let[r,i]=t.mt`
    DELETE FROM message_attachments
    WHERE messageId = ${n.id};
  `;e.prepare(r).run(i),uc(e,n,{editHistoryIndex:null}),n.editHistory?.forEach((t,r)=>{uc(e,{id:n.id,type:n.type,conversationId:n.conversationId,sent_at:t.timestamp,isViewOnce:n.isViewOnce,...t},{editHistoryIndex:r})})}function K({db:e,messageId:n,messageType:r,conversationId:i,sentAt:a,receivedAt:o,receivedAtMs:s,attachmentType:c,attachment:l,orderInMessage:u,editHistoryIndex:d,isViewOnce:f}){let p={messageId:n,messageType:r,editHistoryIndex:d??-1,attachmentType:c,orderInMessage:u,conversationId:i,sentAt:a,receivedAt:o,receivedAtMs:s,clientUuid:l.clientUuid,size:l.size,duration:l.duration,contentType:l.contentType,path:l.path,localKey:l.localKey,plaintextHash:l.plaintextHash,caption:l.caption,blurHash:l.blurHash,height:l.height,width:l.width,digest:l.digest,key:l.key,fileName:l.fileName,downloadPath:l.downloadPath,transitCdnKey:l.cdnKey??l.cdnId,transitCdnNumber:l.cdnNumber,transitCdnUploadTimestamp:l.uploadTimestamp,backupCdnNumber:l.backupCdnNumber,incrementalMac:l.incrementalMac,incrementalMacChunkSize:l.chunkSize,thumbnailPath:l.thumbnail?.path,thumbnailSize:l.thumbnail?.size,thumbnailContentType:l.thumbnail?.contentType,thumbnailLocalKey:l.thumbnail?.localKey,thumbnailVersion:l.thumbnail?.version,screenshotPath:l.screenshot?.path,screenshotSize:l.screenshot?.size,screenshotContentType:l.screenshot?.contentType,screenshotLocalKey:l.screenshot?.localKey,screenshotVersion:l.screenshot?.version,backupThumbnailPath:l.thumbnailFromBackup?.path,backupThumbnailSize:l.thumbnailFromBackup?.size,backupThumbnailContentType:l.thumbnailFromBackup?.contentType,backupThumbnailLocalKey:l.thumbnailFromBackup?.localKey,backupThumbnailVersion:l.thumbnailFromBackup?.version,storyTextAttachmentJson:l.textAttachment?t.ut(l.textAttachment):void 0,localBackupPath:l.localBackupPath,flags:l.flags,error:t.Q(l.error),wasTooBig:t.Q(l.wasTooBig),backfillError:t.Q(l.backfillError),isCorrupted:t.Q(l.isCorrupted),isViewOnce:t.Q(f),copiedFromQuotedAttachment:`copied`in l?t.Q(l.copied):void 0,version:l.version,pending:t.Q(l.pending)};try{let n=t.f(p);e.prepare(`
        INSERT OR REPLACE INTO message_attachments
          (${t.U.join(`, `)})
        VALUES
          (${t.U.map(e=>`$${e}`).join(`, `)});
      `).run(n)}catch(n){V.error(`Failed to save to message_attachments`,t._i(n));let r=t.Zr(to,p);e.prepare(`
        INSERT OR REPLACE INTO message_attachments
          (${t.U.join(`, `)})
        VALUES
          (${t.U.map(e=>`$${e}`).join(`, `)});
      `).run(r),V.info(`Recovered from invalid message_attachment save`)}}function fc(e,{plaintextHash:n,version:r,contentType:i,messageId:a}){if(!t.Er(n)){V.error(`getAndProtectExistingAttachmentPath: Invalid plaintextHash`);return}if(r<2){V.error(`getAndProtectExistingAttachmentPath: Invalid version`,r);return}let[o,s]=t.mt`
    SELECT
      path,
      version,
      localKey,
      width,
      height,
      thumbnailPath,
      thumbnailLocalKey,
      thumbnailVersion,
      thumbnailContentType,
      thumbnailSize,
      screenshotPath,
      screenshotLocalKey,
      screenshotVersion,
      screenshotContentType,
      screenshotSize
    FROM message_attachments
    WHERE
      plaintextHash = ${n} AND
      path IS NOT NULL AND
      version = ${r} AND
      contentType = ${i}
    LIMIT 1;
  `,c=e.prepare(o).get(s);if(!c)return;let[l,u]=t.mt`
      WITH existingMessageAttachmentPaths(path) AS (
        VALUES
          (${c.path}),
          (${c.thumbnailPath}),
          (${c.screenshotPath})
      )
      INSERT OR REPLACE INTO attachments_protected_from_deletion(path, messageId)
      SELECT path, ${a}
      FROM existingMessageAttachmentPaths
      WHERE path IS NOT NULL;
    `;return e.prepare(l).run(u),c}function pc(e,{path:n,messageId:r}){let[i,a]=t.mt`
    INSERT OR REPLACE INTO attachments_protected_from_deletion
      (path, messageId)
    VALUES
      (${n}, ${r});
  `;e.prepare(i).run(a)}function mc(e){e.prepare(`DELETE FROM attachments_protected_from_deletion`).run()}function hc(e){return e.prepare(`SELECT path FROM attachments_protected_from_deletion`,{pluck:!0}).all()}function gc(e,n){let[r,i]=t.mt`
    SELECT EXISTS (
      SELECT 1 FROM attachments_protected_from_deletion
        WHERE path = ${n}
      UNION ALL
        SELECT 1 FROM message_attachments
          WHERE
            path = ${n} OR
            thumbnailPath = ${n} OR
            screenshotPath = ${n} OR
            backupThumbnailPath = ${n}
    );
  `;return e.prepare(r,{pluck:!0}).get(i)===0}function _c(e,n){let[r,i]=t.mt`
    SELECT
      key,
      digest,
      transitCdnKey AS cdnKey,
      transitCdnNumber AS cdnNumber,
      transitCdnUploadTimestamp AS uploadTimestamp,
      incrementalMac,
      incrementalMacChunkSize as chunkSize
    FROM message_attachments
    INDEXED BY message_attachments_plaintextHash
    WHERE
      plaintextHash = ${n} AND
      key IS NOT NULL AND
      digest IS NOT NULL AND
      transitCdnKey IS NOT NULL AND
      transitCdnNumber IS NOT NULL AND
      transitCdnUploadTimestamp IS NOT NULL
    ORDER BY transitCdnUploadTimestamp DESC
    LIMIT 1
  `;return e.prepare(r).get(i)}function vc(e,n){let[r,i]=t.mt`
    DELETE FROM message_attachments
      WHERE sentAt = ${n};`;e.prepare(r).run(i)}function yc(e,n,r){let{alreadyInTransaction:a,forceSave:o,jobToInsert:s,ourAci:c}=r;if(!a)return e.transaction(()=>yc(e,n,{...r,alreadyInTransaction:!0}))();let{body:l,conversationId:u,id:d,isErased:f,isViewOnce:p,mentionsMe:m,received_at:h,received_at_ms:g,schemaVersion:_,sent_at:v,serverGuid:y,source:b,sourceServiceId:x,sourceDevice:S,storyId:ee,timestamp:te,type:C,readStatus:w,expireTimer:ne,expirationStartTimestamp:re,seenStatus:ie,serverTimestamp:ae,unidentifiedDeliveryReceived:oe,hasUnreadPollVotes:se,...ce}=n,{attachments:le,groupV2Change:ue}=n,de=ie;le&&t.Yr(le.every(e=>!e.data&&!e.screenshotData&&!e.screenshot?.data&&!e.thumbnail?.data),`Attempting to save a message with binary attachment data`),w===i.Z.Unread&&de!==i.D.Unseen&&(V.warn(`saveMessage: Message ${d}/${C} is unread but had seenStatus=${de}. Forcing to UnseenStatus.Unseen.`),n={...n,seenStatus:i.D.Unseen},de=i.D.Unseen);let T={...ce},fe=u!=null&&v!=null;fe||V.error(`saveMessage: saving message without conversationId or sent_at!`,{conversationId:u,sent_at:v});let pe=fe&&r._testOnlyAvoidNormalizingAttachments!==!0;pe&&(delete T.attachments,delete T.bodyAttachment,delete T.preview,delete T.quote,delete T.contact,delete T.sticker,delete T.editHistory,T.preview=n.preview?.map(e=>B(e,`image`)),T.quote=n.quote?{...n.quote,attachments:n.quote.attachments.map(e=>B(e,`thumbnail`))}:void 0,T.contact=n.contact?.map(e=>({...e,avatar:B(e.avatar,`avatar`)})),T.sticker=n.sticker?B(n.sticker,`data`):void 0,T.editHistory=n.editHistory?.map(e=>{let t={...e};return delete t.attachments,delete t.bodyAttachment,t.quote=e.quote?{...e.quote,attachments:e.quote.attachments.map(e=>B(e,`thumbnail`))}:void 0,t.preview=e.preview?.map(e=>B(e,`image`)),t}));let me=n.attachments?.filter(e=>e.path!=null),he={id:d,body:l||null,conversationId:u,expirationStartTimestamp:re||null,expireTimer:ne||null,hasAttachments:+((me?.length??0)>0),hasFileAttachments:+!!me?.some(i.Cn),hasVisualMediaAttachments:+!!me?.some(i.jn),hasUnreadPollVotes:+!!se,isChangeCreatedByUs:+(ue?.from===c),isErased:+!!f,isViewOnce:+!!p,mentionsMe:+!!m,received_at:h||null,received_at_ms:g||null,schemaVersion:_||0,serverGuid:y||null,sent_at:v||null,source:b||null,sourceServiceId:x||null,sourceDevice:S||null,storyId:ee||null,type:C||null,timestamp:te??0,readStatus:w??null,seenStatus:de??i.D.NotApplicable,serverTimestamp:ae??null,unidentifiedDeliveryReceived:+!!oe};if(d&&!o){let r=e.prepare(`
        UPDATE messages SET
          ${t.K.map(e=>`${e} = $${e}`).join(`, `)}
        WHERE id = $id;
      `).run({...he,json:t.ut(T)});return r.changes===0?d:(pe&&dc(e,n),s&&X(e,s),t.Yr(r.changes===1,`One row should have been changed`),d)}let ge=d||i.A(n.received_at).id;return e.prepare(`
    INSERT INTO messages (
      ${t.W.join(`, `)}
    ) VALUES (
      ${t.W.map(e=>`$${e}`).join(`, `)}
    );
    `).run({...he,id:ge,json:t.ut(T)}),pe&&dc(e,n),s&&X(e,s),ge}function bc(e,t,n){return e.transaction(()=>{let r=[];for(let i of t)r.push(yc(e,i,{...n,alreadyInTransaction:!0}));return r})()}function xc(e,n,r){try{return bc(e,n,r),{failedIndices:[]}}catch{V.error(`saveMessagesIndividually: Failed to save messages in one transaction, falling over to individual saves`)}return e.transaction(()=>{let i=[];return n.forEach((n,a)=>{try{yc(e,n,r)}catch(e){V.error(`saveMessagesIndividually: failed to save message`,t._i(e)),i.push(a)}}),{failedIndices:i}})()}function Sc(e,t){e.prepare(`DELETE FROM messages WHERE id = $id;`).run({id:t})}function Cc(e,t,n){e.prepare(`
    DELETE FROM messages
    WHERE id IN ( ${t.map(()=>`?`).join(`, `)} );
    `,{persistent:n}).run(t)}function wc(e,n){t.X(e,n,(t,n)=>Cc(e,t,n))}function Tc(e,n){return e.transaction(()=>{let r=e.prepare(`
      SELECT ${t.W.join(`, `)}
      FROM messages
      WHERE id = $id;
    `).get({id:n});if(r)return M(e,r)})()}function Ec(e,n){return e.transaction(()=>t.X(e,n,(n,r)=>N(e,e.prepare(`
          SELECT ${t.W.join(`, `)}
          FROM messages
          WHERE id IN (
            ${Array(n.length).fill(`?`).join(`,`)}
          );`,{persistent:r}).all(n))))()}function Dc(e){return e.transaction(()=>N(e,e.prepare(`
      SELECT ${t.W.join(`, `)}
      FROM messages ORDER BY id ASC
    `).all()))()}function Oc(e){e.exec(`
    DELETE FROM messages;
    INSERT INTO messages_fts(messages_fts) VALUES('optimize');
  `)}function kc(e){return e.prepare(`SELECT id FROM messages ORDER BY id ASC;`).all().map(e=>e.id)}function Ac(e,n,r,i,a){return e.transaction(()=>{let o=n===r?t.gt`(messages.sourceServiceId = ${r} OR messages.type IS 'outgoing')`:t.gt`(messages.sourceServiceId = ${r})`,s=t.gt`
      SELECT ${t.G}
      FROM edited_messages
      INNER JOIN messages ON
        messages.id = edited_messages.messageId
      WHERE ${o}
        AND edited_messages.sentAt = ${i}
    `,c=t.gt`
      SELECT ${t.G}
      FROM messages
      WHERE ${o}
        AND messages.sent_at = ${i}
    `,[l,u]=a.includeEdits?t.mt`${s} UNION ${c} LIMIT 2;`:t.mt`${c} LIMIT 2;`,[d,...f]=e.prepare(l).all(u);return f.length>0&&V.warn(`getMessageByAuthorAciAndSentAt(${r}, ${i}): More than one message found`),d==null?null:M(e,d)})()}function q(e,t){return jc(e,t).predicate}function jc(e,n){return n&&e===void 0?{predicate:t.gt`NULL IS NULL`,isFilteringOnStoryId:!1}:{predicate:t.gt`storyId IS ${e??null}`,isFilteringOnStoryId:!0}}function Mc(e,{conversationId:n,includeStoryReplies:r,readMessageReceivedAt:a,storyId:o,readAt:s,now:c=Date.now()}){return e.transaction(()=>{let l=Math.min(c,s??1/0),{predicate:u,isFilteringOnStoryId:d}=jc(o,r),f=t.gt`
      UPDATE messages
      INDEXED BY messages_conversationId_expirationStartTimestamp
      SET
        expirationStartTimestamp = ${l}
      WHERE
        conversationId = ${n} AND
        ${u} AND
        type IS NOT 'outgoing' AND
        hasExpireTimer IS 1 AND
        received_at <= ${a}
    `,[p,m]=t.mt`
      ${f} AND
        expirationStartTimestamp IS NULL;
    `;e.prepare(p).run(m);let[h,g]=t.mt`
      ${f} AND
        expirationStartTimestamp > ${l};
    `;e.prepare(h).run(g);let _=d?t.gt`messages_unseen_with_story`:t.gt`messages_unseen_no_story`,[v,y]=t.mt`
      SELECT
        id, readStatus, expirationStartTimestamp, sent_at, source, sourceServiceId, type
        FROM messages
        INDEXED BY ${_}
        WHERE
          conversationId = ${n} AND
          seenStatus = ${i.D.Unseen} AND
          isStory = 0 AND
          ${u} AND
          received_at <= ${a}
        ORDER BY received_at DESC, sent_at DESC;
    `,b=e.prepare(v).all(y),[x,S]=t.mt`
      UPDATE messages
        INDEXED BY ${_}
        SET
          readStatus = ${i.Z.Read},
          seenStatus = ${i.D.Seen}
        WHERE
          conversationId = ${n} AND
          seenStatus = ${i.D.Unseen} AND
          isStory = 0 AND
          ${u} AND
          received_at <= ${a};
       `;return e.prepare(x).run(S),b.map(e=>({originalReadStatus:e.readStatus==null?void 0:e.readStatus,readStatus:i.Z.Read,seenStatus:i.D.Seen,id:e.id,expirationStartTimestamp:t.u(e.expirationStartTimestamp),sent_at:e.sent_at||0,source:t.u(e.source),sourceServiceId:t.u(e.sourceServiceId),type:e.type}))})()}function Nc(e,{conversationId:t,readMessageReceivedAt:n,storyId:r}){return e.prepare(`
        UPDATE reactions
        INDEXED BY reactions_unread
        SET unread = 0
        WHERE
          conversationId = $conversationId AND
          unread >= 1 AND
          EXISTS (
            SELECT 1
            FROM messages
            WHERE messages.id = reactions.messageId
              AND messages.received_at <= $readMessageReceivedAt
              AND messages.storyId IS $storyId
          )
        RETURNING targetAuthorAci, targetTimestamp, messageId;
      `).all({conversationId:t,readMessageReceivedAt:n,storyId:r||null})}function Pc(e,t,n){return e.transaction(()=>{let r=e.prepare(`
          SELECT *
          FROM reactions
          WHERE
            targetAuthorAci = $targetAuthorAci AND
            targetTimestamp = $targetTimestamp AND
            unread = 1
          ORDER BY rowId DESC
          LIMIT 1;
        `).get({targetAuthorAci:t,targetTimestamp:n});return e.prepare(`
        UPDATE reactions SET
        unread = 0 WHERE
        targetAuthorAci = $targetAuthorAci AND
        targetTimestamp = $targetTimestamp;
      `).run({targetAuthorAci:t,targetTimestamp:n}),r})()}function Fc(e,{conversationId:t,readMessageReceivedAt:n}){return e.transaction(()=>e.prepare(`
        UPDATE messages
        INDEXED BY messages_unread_poll_votes
        SET hasUnreadPollVotes = 0
        WHERE
          conversationId = $conversationId AND
          hasUnreadPollVotes = 1 AND
          received_at <= $readMessageReceivedAt AND
          type IS 'outgoing'
        RETURNING id, conversationId, sent_at AS targetTimestamp, type;
      `).all({conversationId:t,readMessageReceivedAt:n}))()}function Ic(e,n){return e.transaction(()=>{let r=e.prepare(`
        UPDATE messages
        SET hasUnreadPollVotes = 0
        WHERE
          sent_at = $sent_at AND
          hasUnreadPollVotes = 1 AND
          type IS 'outgoing'
        RETURNING ${t.W.join(`, `)};
      `).get({sent_at:n});if(r)return M(e,r)})()}function Lc(e,n,r){let[i,a]=t.mt`
    SELECT * FROM reactions
    WHERE fromId IS ${n} AND timestamp IS ${r}
  `;return e.prepare(i).get(a)}function Rc(e,{conversationId:t,emoji:n,fromId:r,messageId:a,messageReceivedAt:o,targetAuthorAci:s,targetTimestamp:c,timestamp:l},{readStatus:u}){e.prepare(`INSERT INTO reactions (
      conversationId,
      emoji,
      fromId,
      messageId,
      messageReceivedAt,
      targetAuthorAci,
      targetTimestamp,
      timestamp,
      unread
    ) VALUES (
      $conversationId,
      $emoji,
      $fromId,
      $messageId,
      $messageReceivedAt,
      $targetAuthorAci,
      $targetTimestamp,
      $timestamp,
      $unread
    );`).run({conversationId:t,emoji:n,fromId:r,messageId:a,messageReceivedAt:o,targetAuthorAci:s,targetTimestamp:c,timestamp:l,unread:+(u===i.t.Unread)})}function zc(e,{emoji:t,fromId:n,targetAuthorServiceId:r,targetTimestamp:i}){e.prepare(`DELETE FROM reactions WHERE
      emoji = $emoji AND
      fromId = $fromId AND
      targetAuthorAci = $targetAuthorAci AND
      targetTimestamp = $targetTimestamp;`).run({emoji:t,fromId:n,targetAuthorAci:r,targetTimestamp:i})}function Bc(e){return e.prepare(`SELECT * from reactions;`).all()}function Vc(e){e.prepare(`DELETE from reactions;`).run()}var J=function(e){return e.Older=`Older`,e.Newer=`Newer`,e}(J||{});function Hc(e,n,{limit:r=100,messageId:i,receivedAt:a=Number.MAX_VALUE,sentAt:o=Number.MAX_VALUE}={}){let s={first:t.gt`received_at = ${a} AND sent_at < ${o}`,second:t.gt`received_at < ${a}`},c=e=>t.gt`
    SELECT ${t.G}
    FROM messages
    WHERE
      (${i??null} IS NULL OR id IS NOT ${i??null}) AND
      isStory IS 0 AND
      storyId IS ${n} AND
      (
        ${e}
      )
  `,[l,u]=t.mt`${t.gt`
    SELECT first.* FROM (${c(s.first)}) as first
    UNION ALL
    SELECT second.* FROM (${c(s.second)}) as second
    ORDER BY received_at DESC, sent_at DESC
  `} LIMIT ${r}`;return e.transaction(()=>N(e,e.prepare(l).all(u)))()}function Uc(e,n,{conversationId:r,includeStoryReplies:i,limit:a=100,messageId:o,receivedAt:s=n===J.Older?Number.MAX_VALUE:0,sentAt:c=n===J.Older?Number.MAX_VALUE:0,requireVisualMediaAttachments:l,requireFileAttachments:u,storyId:d}){let f,p;n===J.Older?(f={first:t.gt`received_at = ${s} AND sent_at < ${c}`,second:t.gt`received_at < ${s}`},p=t.gt`DESC`):(f={first:t.gt`received_at = ${s} AND sent_at > ${c}`,second:t.gt`received_at > ${s}`},p=t.gt`ASC`);let m=n===J.Older||l||u,h=e=>t.gt`
    SELECT ${t.G}
    FROM messages WHERE
      conversationId = ${r} AND
      ${m?t.gt`(${o??null} IS NULL OR id IS NOT ${o??null}) AND`:t.gt``}
      ${l?t.gt`hasVisualMediaAttachments IS 1 AND isViewOnce IS 0 AND`:t.gt``}
      ${u?t.gt`hasFileAttachments IS 1 AND isViewOnce IS 0 AND`:t.gt``}
      isStory IS 0 AND
      (${q(d,i)}) AND
      (
        ${e}
      )
      ORDER BY received_at ${p}, sent_at ${p}
  `,[g,_]=t.mt`
    SELECT first.* FROM (${h(f.first)}) as first
    UNION ALL
    SELECT second.* FROM (${h(f.second)}) as second
    LIMIT ${a}
  `;return e.transaction(()=>{let t=e.prepare(g).all(_);return n===J.Older&&t.reverse(),N(e,t)})()}function Wc(e,t){return Uc(e,J.Older,t)}function Gc(e,{conversationId:n,sourceServiceId:r}){return e.transaction(()=>{let[i,a]=t.mt`
    SELECT ${t.G}
    FROM messages
    WHERE
      isStory = 1 AND
      (${n??null} IS NULL OR
        conversationId IS ${n??null}) AND
      (${r??null} IS NULL OR
        sourceServiceId IS ${r??null})
    ORDER BY received_at ASC, sent_at ASC;
  `,o=e.prepare(i).all(a),[s,c]=t.mt`
    SELECT DISTINCT storyId
    FROM messages
    WHERE storyId IS NOT NULL
  `,l=e.prepare(s,{pluck:!0}).all(c),[u,d]=t.mt`
    SELECT DISTINCT storyId
    FROM messages
    WHERE (
      storyId IS NOT NULL AND
      type IS 'outgoing'
    )
  `,f=e.prepare(u,{pluck:!0}).all(d),p=new Set(l),m=new Set(f);return N(e,o).map(e=>({...e,hasReplies:p.has(e.id),hasRepliesFromSelf:m.has(e.id)}))})()}function Kc(e,t){return Uc(e,J.Newer,t)}function qc(e,n,{storyId:r,includeStoryReplies:i}){let[a,o]=t.mt`
    SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${n} AND
        isStory IS 0 AND
        (${q(r,i)})
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
  `,s=e.prepare(a).get(o);if(s)return s}function Jc(e,n,{storyId:r,includeStoryReplies:i}){let[a,o]=t.mt`
    SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${n} AND
        isStory IS 0 AND
        (${q(r,i)})
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
  `,s=e.prepare(a).get(o);if(s)return s}function Yc(e,n,r){let{after:i,before:a,includeStoryReplies:o}=r,[s,c]=t.mt`
    SELECT id
    FROM messages
    WHERE
      conversationId = ${n} AND
      (${q(void 0,o)}) AND
      isStory IS 0 AND
      (
        received_at > ${i.received_at}
        OR (received_at = ${i.received_at} AND sent_at > ${i.sent_at})
      ) AND (
        received_at < ${a.received_at}
        OR (received_at = ${a.received_at} AND sent_at < ${a.sent_at})
      )
    ORDER BY received_at ASC, sent_at ASC;
  `;return e.prepare(s).all(c).map(e=>e.id)}function Xc(e,{conversationId:n,lastSelectedMessage:r,deletedMessageIds:i,storyId:a,includeStoryReplies:o}){function s(s){let c=s?t.gt`ASC`:t.gt`DESC`,l=s?t.gt`>`:t.gt`<`,{received_at:u,sent_at:d}=r,[f,p]=t.mt`
      SELECT id FROM messages WHERE
        conversationId = ${n} AND
        (${q(a,o)}) AND
        isStory IS 0 AND
        id NOT IN (${t.vt(i)}) AND
        type IN ('incoming', 'outgoing')
        AND (
          (received_at = ${u} AND sent_at ${l} ${d}) OR
          received_at ${l} ${u}
        )
      ORDER BY received_at ${c}, sent_at ${c}
      LIMIT 1
    `;return e.prepare(f,{pluck:!0}).get(p)}return s(!0)??s(!1)??null}function Zc(e,{conversationId:n,includeStoryReplies:r}){return e.transaction(()=>{let i=e.prepare(`
      SELECT ${t.W.join(`, `)} FROM messages
      INDEXED BY messages_activity
      WHERE
        conversationId IS $conversationId AND
        shouldAffectActivity IS 1 AND
        isTimerChangeFromSync IS 0 AND
        ${r?``:`storyId IS NULL AND`}
        isGroupLeaveEventFromOther IS 0
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `).get({conversationId:n});if(i)return M(e,i)})()}function Qc(e,{conversationId:n,includeStoryReplies:r}){let i=r?`messages_preview`:`messages_preview_without_story`;return e.transaction(()=>{let a=e.prepare(`
      SELECT ${t.W.join(`, `)}, expiresAt FROM (
        SELECT ${t.W.join(`, `)}, expiresAt FROM messages
        INDEXED BY ${i}
        WHERE
          conversationId IS $conversationId AND
          shouldAffectPreview IS 1 AND
          isGroupLeaveEventFromOther IS 0
          ${r?``:`AND storyId IS NULL`}
        ORDER BY received_at DESC, sent_at DESC
      )
      WHERE likely(expiresAt > $now)
      LIMIT 1
    `).get({conversationId:n,now:Date.now()});return a?M(e,a):void 0})()}function $c(e,{conversationId:t,includeStoryReplies:n}){return e.transaction(()=>({activity:Zc(e,{conversationId:t,includeStoryReplies:n}),preview:Qc(e,{conversationId:t,includeStoryReplies:n}),hasUserInitiatedMessages:ec(e,t)}))()}function el(e,{conversationId:n}){return e.transaction(()=>{let r=e.prepare(`
      SELECT ${t.W.join(`, `)} FROM messages WHERE
        conversationId = $conversationId
      ORDER BY received_at DESC, sent_at DESC
      LIMIT 1;
      `).get({conversationId:n});if(r)return M(e,r)})()}function tl(e,n,{storyId:r,includeStoryReplies:a}){let[o,s]=t.mt`
    SELECT received_at, sent_at, id FROM messages WHERE
      conversationId = ${n} AND
      seenStatus = ${i.D.Unseen} AND
      isStory IS 0 AND
      (${q(r,a)})
    ORDER BY received_at ASC, sent_at ASC
    LIMIT 1;
  `,c=e.prepare(o).get(s);if(c)return c}function nl(e,n,r){let[a,o]=t.mt`
      SELECT received_at, sent_at, id FROM messages WHERE
        conversationId = ${n} AND
        readStatus = ${i.Z.Unread} AND
        mentionsMe IS 1 AND
        isStory IS 0 AND
        (${q(r.storyId,r.includeStoryReplies)})
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `;return e.prepare(a).get(o)}function rl(e,n,{storyId:r,includeStoryReplies:a}){let[o,s]=t.mt`
    SELECT count(1)
    FROM messages
    WHERE
      conversationId = ${n} AND
      readStatus = ${i.Z.Unread} AND
      isStory IS 0 AND
      (${q(r,a)})
  `;return e.prepare(o,{pluck:!0}).get(s)??0}function il(e,n,{storyId:r,includeStoryReplies:a}){let[o,s]=t.mt`
    SELECT count(1)
    FROM messages
    WHERE
      conversationId = ${n} AND
      readStatus = ${i.Z.Unread} AND
      mentionsMe IS 1 AND
      isStory IS 0 AND
      (${q(r,a)})
  `;return e.prepare(o,{pluck:!0}).get(s)??0}function al(e,n,{storyId:r,includeStoryReplies:a}){let[o,s]=t.mt`
    SELECT count(1)
      FROM messages
      WHERE
        conversationId = ${n} AND
        seenStatus = ${i.D.Unseen} AND
        isStory IS 0 AND
        (${q(r,a)})
  `;return e.prepare(o,{pluck:!0}).get(s)??0}function ol(e,t){let{conversationId:n}=t;return{oldest:qc(e,n,t),newest:Jc(e,n,t),oldestUnseen:tl(e,n,t),totalUnseen:al(e,n,t)}}function sl(e,t){return e.transaction(()=>({older:Uc(e,J.Older,t),newer:Uc(e,J.Newer,t),metrics:ol(e,t)}))()}function cl(e){let[n]=t.mt`
    SELECT * FROM callsHistory;
  `;return e.prepare(n).all()}function ll(e){let[n,r]=t.mt`
    DELETE FROM callsHistory;
  `;e.prepare(n).run(r)}function ul(e,n){return e.transaction(()=>{let r=Tl(e,n);if(r==null)return V.warn(`clearCallHistory: Target call not found`),[];let{timestamp:a}=r,[o,s]=t.mt`
      SELECT roomId
      FROM callLinks
      WHERE callLinks.adminKey IS NOT NULL;
    `,[c,l]=t.mt`
      SELECT callsHistory.callId
      FROM callsHistory
      WHERE
        (
          -- Prior calls
          (callsHistory.timestamp <= ${a})
          -- Unused call links
          OR (
            callsHistory.mode IS ${xl} AND
            callsHistory.status IS ${yl}
          )
        ) AND
        callsHistory.peerId NOT IN (${t.vt(e.prepare(o,{pluck:!0}).all(s))});
    `,u=e.prepare(c,{pluck:!0}).all(l),d=[];return t.X(e,u,(n,r)=>{let a=t.vt(n),[o,s]=t.mt`
        UPDATE callsHistory
        SET
          status = ${i.ct.Deleted},
          timestamp = ${Date.now()}
        WHERE callsHistory.callId IN (${a});
      `;e.prepare(o,{persistent:r}).run(s);let[c,l]=t.mt`
        DELETE FROM messages
        WHERE messages.type IS 'call-history'
        AND messages.callId IN (${a})
        RETURNING id;
      `,u=e.prepare(c,{pluck:!0,persistent:r}).all(l);d=d.concat(u)}),d})()}function dl(e,n){let[r,a]=t.mt`
    UPDATE callsHistory
    SET
      status = ${i.ct.Deleted},
      timestamp = ${Date.now()}
    WHERE callId = ${n}
  `;e.prepare(r).run(a)}function fl(e){return e.transaction(()=>{let[n,r]=t.mt`
        DELETE FROM messages
        WHERE messages.id IN (
          SELECT messages.id FROM messages
          LEFT JOIN callsHistory ON callsHistory.callId IS messages.callId
          WHERE messages.type IS 'call-history'
          AND callsHistory.status IS ${vl}
        )
      `;e.prepare(n).run(r)})()}function pl(e,n){return e.transaction(()=>{let[r,i]=t.mt`
    SELECT ${t.G}
    FROM messages
    WHERE conversationId = ${n.conversationId}
      AND type = 'call-history'
      AND callId = ${n.callId}
  `,a=e.prepare(r).get(i);if(a!=null)return M(e,a)})()}function ml(e,n,r){let[a,o]=t.mt`
    SELECT * FROM callsHistory
    WHERE callId IS ${n}
    AND peerId IS ${r};
  `,s=e.prepare(a).get(o);if(s!=null)return t.ei(i.ht,s)}const hl=t.ht(i.Z.Read),gl=t.ht(i.D.Unseen),_l=t.ht(i.D.Seen),Y=t.ht(i.at.Missed),vl=t.ht(i.at.Deleted),yl=t.ht(i.at.Pending),bl=t.ht(i.tt.Incoming),xl=t.ht(i.it.Adhoc),Sl=t.ht(14400*1e3);function Cl(e){let[n,r]=t.mt`
    SELECT count(*) FROM messages
    INNER JOIN callsHistory ON callsHistory.callId = messages.callId
    WHERE messages.type IS 'call-history'
      AND messages.seenStatus IS ${gl}
      AND callsHistory.status IS ${Y}
      AND callsHistory.direction IS ${bl}
  `;return e.prepare(n,{pluck:!0}).get(r)??0}function wl(e,n){let[r,a]=t.mt`
    UPDATE messages
    SET
      seenStatus = ${_l},
      json = json_patch(json, ${JSON.stringify({seenStatus:i.D.Seen})})
    WHERE type IS 'call-history'
    AND callId IS ${n}
  `;e.prepare(r).run(a)}function Tl(e,n){let{callId:r,timestamp:a}=n;if(`peerId`in n){let{peerId:o}=n,s;if(r==null||o==null){let[r,i]=t.mt`
        SELECT *
        FROM callsHistory
        WHERE ${o==null?t.gt`TRUE`:t.gt`callsHistory.peerId IS ${n.peerId}`}
          AND callsHistory.timestamp <= ${a}
        ORDER BY callsHistory.timestamp DESC
        LIMIT 1
      `;s=e.prepare(r).get(i)}else{let[r,i]=t.mt`
        SELECT *
        FROM callsHistory
        WHERE callsHistory.peerId IS ${n.peerId}
          AND callsHistory.callId IS ${n.callId}
        LIMIT 1
      `;s=e.prepare(r).get(i)}return s==null?null:t.ei(i.ht,s)}if(`peerIdAsConversationId`in n&&`peerIdAsRoomId`in n)return Tl(e,{callId:r,timestamp:a,peerId:n.peerIdAsConversationId})||Tl(e,{callId:r,timestamp:a,peerId:n.peerIdAsRoomId})||null;throw Error(`Either peerId, or peerIdAsConversationId and peerIdAsRoomId must be present`)}function El(e,n){let{peerId:r,mode:a}=n;if(a===i.it.Adhoc)throw Error(`getConversationIdForCallHistory: Adhoc calls do not have conversations`);let[o,s]=t.mt`
    SELECT id FROM conversations
    WHERE ${a===i.it.Direct?t.gt`serviceId IS ${r}`:t.gt`groupId IS ${r}`}
  `,c=e.prepare(o,{pluck:!0}).get(s);return typeof c==`string`?c??null:(V.warn(`getConversationIdForCallHistory: Unknown conversation`),null)}function Dl(e,n,r){let[i,a]=t.mt`
    SELECT messages.received_at
    FROM messages
    WHERE messages.type IS 'call-history'
      AND messages.conversationId IS ${r}
      AND messages.callId IS ${n}
    LIMIT 1
  `,o=e.prepare(i,{pluck:!0}).get(a);if(o==null){V.warn(`getMessageReceivedAtForCall: Target call message not found`);return}return o}function Ol(e,n,r=!1){return e.transaction(()=>{let a=Tl(e,n);if(a==null)return V.warn(`markAllCallHistoryRead: Target call not found`),0;let{callId:o}=a;t.Yr(n.callId==null||o===n.callId,`Call ID must be the same as target if supplied`);let s,c;if(a.mode===i.it.Adhoc)t.Yr(!r,`markAllCallHistoryRead: Not possible to mark read in conversation for Adhoc calls`),c=a.timestamp,s=t.gt`TRUE`;else{let n=El(e,a);if(n==null)return V.warn(`markAllCallHistoryRead: Conversation not found for call`),0;V.info(`markAllCallHistoryRead: Found conversation ${n}`),c=Dl(e,o,n),s=r?t.gt`messages.conversationId IS ${n}`:t.gt`TRUE`}if(c==null)return V.warn(`markAllCallHistoryRead: Message not found for call`),0;let l=JSON.stringify({readStatus:i.Z.Read,seenStatus:i.D.Seen});V.info(`markAllCallHistoryRead: Marking calls before ${c} read`);let[u,d]=t.mt`
      UPDATE messages
      SET
        readStatus = ${hl},
        seenStatus = ${_l},
        json = json_patch(json, ${l})
      WHERE messages.type IS 'call-history'
        AND ${s}
        AND messages.seenStatus IS ${gl}
        AND messages.received_at <= ${c};
    `;return e.prepare(u).run(d).changes})()}function kl(e,t){return Ol(e,t,!0)}function Al(e,n,r,a){return e.transaction(()=>{let{limit:o,offset:s}=a,{status:c,conversationIds:l,callLinkRoomIds:u}=r,d=l!=null||u!=null;if(d){let[n]=t.mt`
        CREATE TEMP TABLE temp_callHistory_filtered_peers (
          conversationId TEXT,
          serviceId TEXT,
          groupId TEXT,
          callLinkRoomId TEXT
        );
      `;e.exec(n),l!=null&&(t.Yr(l.length>0,`can't filter by empty array`),t.X(e,l,(n,r)=>{let[i,a]=t.mt`
            INSERT INTO temp_callHistory_filtered_peers
              (conversationId, serviceId, groupId)
            SELECT id, serviceId, groupId
            FROM conversations
            WHERE conversations.id IN (${t.vt(n.map(e=>t.gt`${e}`))});
          `;e.prepare(i,{persistent:r}).run(a)})),u!=null&&(t.Yr(u.length>0,`can't filter by empty array`),t.X(e,u,(n,r)=>{let[i,a]=t.mt`
            INSERT INTO temp_callHistory_filtered_peers
              (callLinkRoomId)
            VALUES ${t.vt(n.map(e=>t.gt`(${e})`))};
          `;e.prepare(i,{persistent:r}).run(a)}))}let f=d?t.gt`
          INNER JOIN temp_callHistory_filtered_peers ON (
            temp_callHistory_filtered_peers.conversationId IS c.peerId
            OR temp_callHistory_filtered_peers.serviceId IS c.peerId
            OR temp_callHistory_filtered_peers.groupId IS c.peerId
            OR temp_callHistory_filtered_peers.callLinkRoomId IS c.peerId
          )
        `:t.gt``,p=c===i.nt.All?t.gt`status IS NOT ${vl}`:t.gt`
            direction IS ${bl} AND
            status IS ${Y} AND status IS NOT ${vl}
          `,m=o>0?t.gt`LIMIT ${o} OFFSET ${s}`:t.gt``,[h,g]=t.mt`
      SELECT
        ${n?t.gt`COUNT(*) OVER() AS count`:t.gt`peerId, ringerId, mode, type, direction, status, timestamp, possibleChildren, inPeriod`}
      FROM (
        -- 1. 'callAndGroupInfo': This section collects metadata to determine the
        -- parent and children of each call. We can identify the real parents of calls
        -- within the query, but we need to build the children at runtime.
        WITH callAndGroupInfo AS (
          SELECT
            *,
            -- 1a. 'possibleParent': This identifies the first call that _could_ be
            -- considered the current call's parent. Note: The 'possibleParent' is not
            -- necessarily the true parent if there is another call between them that
            -- isn't a part of the group.
            (
              SELECT callId
              FROM callsHistory
              WHERE
                callsHistory.direction IS c.direction
                AND callsHistory.type IS c.type
                AND callsHistory.peerId IS c.peerId
                AND (callsHistory.timestamp - ${Sl}) <= c.timestamp
                AND callsHistory.timestamp >= c.timestamp
                -- Tracking Android & Desktop separately to make the queries easier to compare
                -- Android Constraints:
                AND (
                  (callsHistory.status IS c.status AND callsHistory.status IS ${Y}) OR
                  (callsHistory.status IS NOT ${Y} AND c.status IS NOT ${Y})
                )
                -- Desktop Constraints:
                AND callsHistory.status IS c.status
                AND ${p}
              ORDER BY timestamp DESC
            ) as possibleParent,
            -- 1b. 'possibleChildren': This identifies all possible calls that can
            -- be grouped with the current call. Note: This current call is not
            -- necessarily the parent, and not all possible children will end up as
            -- children as they might have another parent
            (
              SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT(
                  'callId', callId,
                  'timestamp', timestamp
                )
              )
              FROM callsHistory
              WHERE
                callsHistory.direction IS c.direction
                AND callsHistory.type IS c.type
                AND callsHistory.peerId IS c.peerId
                AND (c.timestamp - ${Sl}) <= callsHistory.timestamp
                AND c.timestamp >= callsHistory.timestamp
                -- Tracking Android & Desktop separately to make the queries easier to compare
                -- Android Constraints:
                AND (
                  (callsHistory.status IS c.status AND callsHistory.status IS ${Y}) OR
                  (callsHistory.status IS NOT ${Y} AND c.status IS NOT ${Y})
                )
                -- Desktop Constraints:
                AND callsHistory.status IS c.status
                AND ${p}
              ORDER BY timestamp DESC
            ) as possibleChildren,

            -- 1c. 'inPeriod': This identifies all calls in a time period after the
            -- current call. They may or may not be a part of the group.
            (
              SELECT GROUP_CONCAT(callId)
              FROM callsHistory
              WHERE
                (c.timestamp - ${Sl}) <= callsHistory.timestamp
                AND c.timestamp >= callsHistory.timestamp
                AND ${p}
            ) AS inPeriod
          FROM callsHistory AS c
          ${f}
          WHERE
            ${p}
          ORDER BY timestamp DESC
        )
        -- 2. 'isParent': We need to identify the true parent of the group in cases
        -- where the previous call is not a part of the group.
        SELECT
          *,
          CASE
            WHEN LAG (possibleParent, 1, 0) OVER (
              -- Note: This is an optimization assuming that we've already got 'timestamp DESC' ordering
              -- from the query above. If we find that ordering isn't always correct, we can uncomment this:
              -- ORDER BY timestamp DESC
            ) != possibleParent THEN callId
            ELSE possibleParent
          END AS parent
        FROM callAndGroupInfo
      ) AS parentCallAndGroupInfo
      WHERE parent = parentCallAndGroupInfo.callId
      GROUP BY
        CASE
          -- By spec, limit adhoc call history to the most recent call
          WHEN mode IS ${xl} THEN peerId
          ELSE callId
        END
      ORDER BY parentCallAndGroupInfo.timestamp DESC
      ${m};
    `,_=n?e.prepare(h,{pluck:!0}).get(g):e.prepare(h).all(g);if(d){let[n]=t.mt`
        DROP TABLE temp_callHistory_filtered_peers;
      `;e.exec(n)}return _})()}const jl=t.Li().int().nonnegative();function Ml(e,n){let r=Al(No(e,`only temp table use`),!0,n,{limit:0,offset:0});return r==null?0:t.ei(jl,r)}const Nl=t.ki(i.gt.omit({children:!0}).extend({possibleChildren:t.Vi(),inPeriod:t.Vi()})),Pl=t.ki(i.ht.pick({callId:!0,timestamp:!0}));function Fl(e,n,r){let a=t.ei(Nl,Al(No(e,`only temp table use`),!1,n,r)),o=new Set;return a.map(e=>({...e,possibleChildren:t.ei(Pl,JSON.parse(e.possibleChildren)),inPeriod:new Set(e.inPeriod.split(`,`))})).reverse().map(e=>{let{possibleChildren:n,inPeriod:r,type:a,...s}=e,c=[];for(let e of n)if(!o.has(e.callId)&&r.has(e.callId)&&(c.push(e),o.add(e.callId),a===i.ot.Adhoc))break;return t.$r(i.gt,{...s,type:a,children:c})}).reverse()}function Il(e,n){let[r,i]=t.mt`
    INSERT OR REPLACE INTO callsHistory (
      callId,
      peerId,
      ringerId,
      startedById,
      mode,
      type,
      direction,
      status,
      timestamp,
      endedTimestamp
    ) VALUES (
      ${n.callId},
      ${n.peerId},
      ${n.ringerId},
      ${n.startedById},
      ${n.mode},
      ${n.type},
      ${n.direction},
      ${n.status},
      ${n.timestamp},
      ${n.endedTimestamp}
    );
  `;e.prepare(r).run(i)}function Ll(e,t,n){return e.prepare(`
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE conversationId = $conversationId
        AND type = 'call-history'
        AND json_extract(json, '$.callHistoryDetails.callMode') = 'Group'
        AND json_extract(json, '$.callHistoryDetails.eraId') = $eraId
      );
      `,{pluck:!0}).get({conversationId:t,eraId:n})===1}function Rl(e,n){return e.transaction(()=>{let r,i,a;{let[i,a]=t.mt`
        SELECT EXISTS(
          SELECT 1 FROM message_attachments
          INDEXED BY message_attachments_getOlderMedia
          WHERE
            conversationId IS ${n} AND
            editHistoryIndex IS -1 AND
            attachmentType IS 'attachment' AND
            messageType IN ('incoming', 'outgoing') AND
            isViewOnce IS NOT 1 AND
            contentType IS NOT NULL AND
            contentType IS NOT '' AND
            contentType IS NOT 'text/x-signal-plain'
        );
      `;r=e.prepare(i,{pluck:!0}).get(a)===1}{let[r,a]=t.mt`
        SELECT EXISTS(
          SELECT 1 FROM messages
          INDEXED BY messages_hasPreviews
          WHERE
            conversationId IS ${n} AND
            type IN ('incoming', 'outgoing') AND
            isViewOnce IS NOT 1 AND
            hasPreviews IS 1
        );
      `;i=e.prepare(r,{pluck:!0}).get(a)===1}{let[r,i]=t.mt`
        SELECT EXISTS(
          SELECT 1 FROM messages
          INDEXED BY messages_hasContacts
          WHERE
            conversationId IS ${n} AND
            type IN ('incoming', 'outgoing') AND
            isViewOnce IS NOT 1 AND
            hasContacts IS 1
        );
      `;a=e.prepare(r,{pluck:!0}).get(i)===1}return r||i||a})()}const{VOICE_MESSAGE:zl}=t.o.signalservice.AttachmentPointer.Flags;function Bl(e,{order:r,conversationId:i,limit:a,messageId:o,receivedAt:s,sentAt:c,size:l,type:u}){let d,f,p;if(r===`older`){let e=s??Number.MAX_VALUE,n=c??Number.MAX_VALUE;d=t.gt`message_attachments_getOlderMedia`,f={first:t.gt`
        message_attachments.receivedAt = ${e}
        AND
        message_attachments.sentAt < ${n}
      `,second:t.gt`message_attachments.receivedAt < ${e}`},p=t.gt`
      message_attachments.receivedAt DESC,
      message_attachments.sentAt DESC
    `}else if(r===`newer`){let e=s??Number.MIN_VALUE,n=c??Number.MIN_VALUE;d=t.gt`message_attachments_getOlderMedia`,f={first:t.gt`
        message_attachments.receivedAt = ${e}
        AND
        message_attachments.sentAt > ${n}
      `,second:t.gt`message_attachments.receivedAt > ${e}`},p=t.gt`
      message_attachments.receivedAt ASC,
      message_attachments.sentAt ASC
    `}else if(r===`bigger`){let e=l??Number.MAX_VALUE,n=s??Number.MAX_VALUE,r=c??Number.MAX_VALUE;d=t.gt`message_attachments_sortBiggerMedia`,f={first:t.gt`
        message_attachments.size = ${e}
        AND
        message_attachments.receivedAt = ${n}
        AND
        message_attachments.sentAt < ${r}
      `,second:t.gt`
        message_attachments.size = ${e}
        AND
        message_attachments.receivedAt < ${n}
      `,third:t.gt`
        message_attachments.size < ${e}
      `},p=t.gt`
      message_attachments.size DESC,
      message_attachments.receivedAt DESC,
      message_attachments.sentAt DESC
    `}else throw n.p(r);let m;if(u===`media`)m=t.gt`
      message_attachments.flags IS NOT ${zl} AND
      (
        message_attachments.contentType LIKE 'image/%' OR
        message_attachments.contentType LIKE 'video/%'
      )
    `;else if(u===`audio`)m=t.gt`
      message_attachments.flags IS ${zl} OR
      message_attachments.contentType LIKE 'audio/%'
    `;else if(u===`documents`)m=t.gt`
      message_attachments.flags IS NOT ${zl} AND
      message_attachments.contentType IS NOT 'text/x-signal-plain' AND
      message_attachments.contentType NOT LIKE 'audio/%' AND
      message_attachments.contentType NOT LIKE 'image/%' AND
      message_attachments.contentType NOT LIKE 'video/%'
    `;else throw n.p(u);let h=e=>t.gt`
    SELECT
      message_attachments.*,
      messages.json -> '$.sendStateByConversationId' AS messageSendState,
      messages.json -> '$.errors' AS messageErrors,
      messages.isErased AS messageIsErased,
      messages.readStatus AS messageReadStatus,
      messages.source AS messageSource,
      messages.sourceServiceId AS messageSourceServiceId
    FROM message_attachments
    INDEXED BY ${d}
    INNER JOIN messages ON
      messages.id = message_attachments.messageId
    WHERE
      message_attachments.conversationId IS ${i} AND
      message_attachments.editHistoryIndex IS -1 AND
      message_attachments.attachmentType IS 'attachment' AND
      (
        ${e}
      ) AND
      (${m}) AND
      message_attachments.isViewOnce IS NOT 1 AND
      message_attachments.messageType IN ('incoming', 'outgoing') AND
      (${o??null} IS NULL OR message_attachments.messageId IS NOT ${o??null})
      ORDER BY ${p}
      LIMIT ${a}
  `,g;if(r===`older`||r===`newer`)g=t.mt`
      SELECT first.* FROM (${h(f.first)}) as first
      UNION ALL
      SELECT second.* FROM (${h(f.second)}) as second
    `;else if(r===`bigger`)t.Yr(f.third!=null,`file size filter is required`),g=t.mt`
      SELECT first.* FROM (${h(f.first)}) as first
      UNION ALL
      SELECT second.* FROM (${h(f.second)}) as second
      UNION ALL
      SELECT third.* FROM (${h(f.third)}) as third
    `;else throw n.p(r);let[_,v]=g;return e.prepare(_).all(v).map(e=>{let{orderInMessage:t,messageType:n,messageSource:r,messageSourceServiceId:a,messageSendState:o,messageErrors:s,messageIsErased:c,messageReadStatus:l,sentAt:u,receivedAt:d,receivedAtMs:f}=e;return{type:`mediaItem`,message:{id:e.messageId,type:n,source:r??void 0,sourceServiceId:a??void 0,conversationId:i,receivedAt:d,receivedAtMs:f??void 0,sentAt:u,sendStateByConversationId:o==null?void 0:JSON.parse(o),errors:s==null?void 0:JSON.parse(s),isErased:c===1,readStatus:l??void 0},index:t,attachment:P(e)}})}function Vl(e,{conversationId:r,limit:i,messageId:a,receivedAt:o=Number.MAX_VALUE,sentAt:s=Number.MAX_VALUE,type:c}){let l={first:t.gt`received_at = ${o} AND sent_at < ${s}`,second:t.gt`received_at < ${o}`},u,d;if(c===`links`)u=t.gt`messages_hasPreviews`,d=t.gt`hasPreviews IS 1`;else if(c===`contacts`)u=t.gt`messages_hasContacts`,d=t.gt`hasContacts IS 1`;else throw n.p(c);let f=e=>t.gt`
    SELECT ${t.G}
    FROM messages
    INDEXED BY ${u}
    WHERE
      conversationId IS ${r} AND
      (${d}) AND
      isViewOnce IS NOT 1 AND
      type IN ('incoming', 'outgoing') AND
      (${a??null} IS NULL OR id IS NOT ${a??null})
      AND (${e})
      ORDER BY received_at DESC, sent_at DESC
      LIMIT ${i}
  `,[p,m]=t.mt`
    SELECT first.* FROM (${f(l.first)}) as first
    UNION ALL
    SELECT second.* FROM (${f(l.second)}) as second
  `;return N(e,e.prepare(p).all(m)).map(e=>{let i={id:e.id,type:e.type,conversationId:r,source:e.source,sourceServiceId:e.sourceServiceId,receivedAt:e.received_at,receivedAtMs:e.received_at_ms??void 0,sentAt:e.sent_at,errors:t.u(e.errors),sendStateByConversationId:e.sendStateByConversationId,readStatus:e.readStatus,isErased:!!e.isErased};if(c===`links`){let n=e.preview?.[0];return t.Yr(n,`getSortedNonAttachmentMedia: got message without preview ${e.id}`),{type:`link`,message:i,preview:n}}if(c===`contacts`){let n=e.contact?.[0];return t.Yr(n,`getSortedNonAttachmentMedia: got message without contact ${e.id}`),{type:`contact`,message:i,contact:n}}throw n.p(c)})}function Hl(e,t){return e.transaction(()=>{let n=Bl(e,{...t,order:`older`,type:`documents`}),r=Vl(e,{...t,type:`contacts`});return ho(n.concat(r),[e=>e.message.receivedAt,e=>e.message.sentAt],[`DESC`,`DESC`]).slice(0,t.limit)})()}function Ul(e,n){t.X(e,n,(n,r)=>{let[a,o]=t.mt`
      UPDATE callsHistory
      SET status = ${t.ht(i.lt.Missed)}
      WHERE callId IN (${t.vt(n)})
    `;return e.prepare(a,{persistent:r}).run(o)})}function Wl(e,t){return e.transaction(()=>Ul(e,t))()}function Gl(e){return e.transaction(()=>{let[n,r]=t.mt`
      SELECT callId, peerId FROM callsHistory
      WHERE
        type = ${t.ht(i.ot.Group)} AND
        status = ${t.ht(i.lt.Ringing)}
      ORDER BY timestamp DESC
    `,a=e.prepare(n).all(r),o=new Set,[s,c]=po(a,e=>o.size>=10||o.has(e.peerId)?!1:(o.add(e.peerId),!0));return Ul(e,c.map(e=>e.callId)),s})()}function Kl(e,t,n){let r=1e3,i=e.prepare(`
    SELECT
      rowid,
      json -> '$.sendStateByConversationId' AS sendStateJson,
      json -> '$.editHistory' AS editHistoryJson
    FROM messages
    WHERE conversationId IS $obsoleteId
    ORDER BY rowid
    LIMIT $pageSize OFFSET $offset`),a=e.prepare(`
    UPDATE messages
    SET
      conversationId = $currentId,
      json = json_patch(json, $patch)
    WHERE
      rowid IS $rowid
  `);e.transaction(()=>{for(let e=0;;e+=r){let o=i.all({obsoleteId:t,pageSize:r,offset:e});for(let{rowid:e,sendStateJson:r,editHistoryJson:i}of o){let o=JSON.parse(i||`[]`),s=JSON.parse(r||`{}`),c={conversationId:n,sendStateByConversationId:{[t]:null,[n]:s[t]},editHistory:o.map(({sendStateByConversationId:e,...r})=>{let i=e?.[t];return i?{...r,sendStateByConversationId:{...e,[t]:void 0,[n]:i}}:r})};a.run({rowid:e,patch:JSON.stringify(c),currentId:n})}if(o.length<r)break}})()}function ql(e,n){return e.transaction(()=>{let[r,i]=t.mt`
      SELECT ${t.G}
      FROM edited_messages
      INNER JOIN messages ON
        messages.id = edited_messages.messageId
      WHERE edited_messages.sentAt = ${n}
      UNION
      SELECT ${t.G}
      FROM messages
      WHERE sent_at = ${n}
      ORDER BY messages.received_at DESC, messages.sent_at DESC;
    `;return N(e,e.prepare(r).all(i))})()}function Jl(e){return e.transaction(()=>{let n=Date.now();return N(e,e.prepare(`
      SELECT ${t.W.join(`, `)}, expiresAt
      FROM messages
      WHERE
        expiresAt <= $now
      ORDER BY expiresAt ASC;
      `).all({now:n}))})()}function Yl(e){return e.transaction(()=>N(e,e.prepare(`
      SELECT ${t.W.join(`, `)} FROM messages
      INDEXED BY messages_unexpectedly_missing_expiration_start_timestamp
      WHERE
        expireTimer > 0 AND
        expirationStartTimestamp IS NULL AND (
          readStatus = ${i.Z.Read} OR
          readStatus = ${i.Z.Viewed} OR
          readStatus IS NULL
        )
      `).all()))()}function Xl(e){let t=e.prepare(`
      SELECT MIN(expiresAt)
      FROM messages;
      `,{pluck:!0}).get();if(!(t!=null&&t>=2**53-1))return t||void 0}function Zl(e){return e.transaction(()=>{let n=e.prepare(`
      SELECT ${t.W.join(`, `)} FROM messages
      WHERE
        -- we want this query to use the messages_view_once index rather than received_at
        likelihood(isViewOnce = 1, 0.01)
        AND (isErased IS NULL OR isErased != 1)
      ORDER BY received_at ASC, sent_at ASC
      LIMIT 1;
      `).get();if(!n)return;let r=M(e,n).received_at_ms;return i.Xn(r)?r:void 0})()}function Ql(e,n){return e.transaction(()=>N(e,e.prepare(`
      SELECT ${t.W.join(`, `)}
      FROM messages
      WHERE
        isViewOnce = 1
        AND (isErased IS NULL OR isErased != 1)
        AND (
          IFNULL(received_at_ms, 0) <= $maxTimestamp
        )
      `).all({maxTimestamp:n})))()}function $l(e,t){let{id:n,timestamp:r,receivedAtDate:i,receivedAtCounter:a,attempts:o,type:s,isEncrypted:c,content:l,messageAgeSec:u,source:d,sourceServiceId:f,sourceDevice:p,destinationServiceId:m,updatedPni:h,serverGuid:g,serverTimestamp:_,urgent:v,story:y,reportingToken:b,groupId:x}=t;if(!n)throw Error(`saveUnprocessed: id was falsey`);return e.prepare(`
    INSERT OR REPLACE INTO unprocessed (
      id,
      timestamp,
      receivedAtCounter,
      receivedAtDate,
      attempts,
      type,
      isEncrypted,
      content,

      messageAgeSec,
      source,
      sourceServiceId,
      sourceDevice,
      destinationServiceId,
      updatedPni,
      serverGuid,
      serverTimestamp,
      urgent,
      story,
      reportingToken,
      groupId
    ) values (
      $id,
      $timestamp,
      $receivedAtCounter,
      $receivedAtDate,
      $attempts,
      $type,
      $isEncrypted,
      $content,

      $messageAgeSec,
      $source,
      $sourceServiceId,
      $sourceDevice,
      $destinationServiceId,
      $updatedPni,
      $serverGuid,
      $serverTimestamp,
      $urgent,
      $story,
      $reportingToken,
      $groupId
    );
    `).run({id:n,timestamp:r,receivedAtCounter:a,receivedAtDate:i,attempts:o,type:s,isEncrypted:+!!c,content:l,messageAgeSec:u,source:d||null,sourceServiceId:f||null,sourceDevice:p||null,destinationServiceId:m,updatedPni:h||null,serverGuid:g,serverTimestamp:_,urgent:v||!ao(v)?1:0,story:+!!y,reportingToken:b||null,groupId:x||null}),n}function eu(e){return t.rt(e,`unprocessed`)}function tu(e){return e.transaction(()=>{let{changes:n}=e.prepare(`DELETE FROM unprocessed WHERE receivedAtDate < $messageQueueCutoff`).run({messageQueueCutoff:Date.now()-45*t.It});n!==0&&V.warn(`getAllUnprocessedAndIncrementAttempts: deleting ${n} old unprocessed envelopes`);let{changes:r}=e.prepare(`
          DELETE FROM unprocessed
          WHERE attempts >= $MAX_UNPROCESSED_ATTEMPTS
        `).run({MAX_UNPROCESSED_ATTEMPTS:10});return r!==0&&V.warn(`getAllUnprocessedAndIncrementAttempts: deleting ${r} invalid unprocessed envelopes`),e.prepare(`
      SELECT id
      FROM unprocessed
      ORDER BY receivedAtCounter ASC
    `,{pluck:!0}).all()})()}function nu(e,n){return V.info(`getUnprocessedByIdsAndIncrementAttempts`,{totalIds:n.length}),t.X(e,n,(t,n)=>e.prepare(`
          UPDATE unprocessed
          SET attempts = attempts + 1
          WHERE id IN (${t.map(()=>`?`).join(`, `)})
        `,{persistent:n}).run(t)),t.X(e,n,(t,n)=>e.prepare(`
          SELECT *
          FROM unprocessed
          WHERE id IN (${t.map(()=>`?`).join(`, `)})
          ORDER BY receivedAtCounter ASC;
        `,{persistent:n}).all(t).map(e=>({...e,urgent:z(e.urgent)?!!e.urgent:!0,story:!!e.story,isEncrypted:!!e.isEncrypted})))}function ru(e,t,n){e.prepare(`
    DELETE FROM unprocessed
    WHERE id IN ( ${t.map(()=>`?`).join(`, `)} );
    `,{persistent:n}).run(t)}function iu(e,n){if(!Array.isArray(n)){e.prepare(`DELETE FROM unprocessed WHERE id = $id;`).run({id:n});return}n.length&&t.X(e,n,(t,n)=>ru(e,t,n))}function au(e){e.prepare(`DELETE FROM unprocessed;`).run()}function ou(e,n){let[r,i]=t.mt`
    SELECT * FROM attachment_downloads
    WHERE
      messageId = ${n.messageId}
    AND
      attachmentType = ${n.attachmentType}
    AND
      attachmentSignature = ${n.attachmentSignature};
  `,a=e.prepare(r).get(i);if(a===void 0)return;let{attachmentJson:o,...s}=a;return t.ei(t.R,{...s,active:!!a.active,attachment:JSON.parse(o),ciphertextSize:a.ciphertextSize||0})}function su(e){let[n,r]=t.mt`
    DELETE FROM attachment_downloads
    WHERE
      source = ${t.H.BACKUP_IMPORT_WITH_MEDIA}
    OR
      source = ${t.H.BACKUP_IMPORT_NO_MEDIA};`;e.prepare(n).run(r)}function cu(e){let[n,r]=t.mt`
    INSERT OR REPLACE INTO attachment_downloads_backup_stats
      (id, totalBytes, completedBytes)
    VALUES
      (0,0,0);
  `;e.prepare(n).run(r)}function lu(e){let[n,r]=t.mt`
    SELECT totalBytes, completedBytes FROM attachment_downloads_backup_stats
    WHERE id = 0;
  `;return e.prepare(n).get(r)??{totalBytes:0,completedBytes:0}}function uu(e,{limit:n,sources:r,prioritizeMessageIds:i,timestamp:a=Date.now(),maxLastAttemptForPrioritizedMessages:o}){let s=[],c=r?t.gt`
      source IN (${t.vt(r)})
    `:t.gt`
      TRUE
    `;if(i?.length){let[r,l]=t.mt`
      SELECT * FROM attachment_downloads
      -- very few rows will match messageIds, so in this case we want to optimize
      -- the WHERE clause rather than the ORDER BY
      INDEXED BY attachment_downloads_active_messageId
      WHERE
        active = 0
      AND
        -- for priority messages, we want to retry based on the last attempt, rather than retryAfter
        (lastAttemptTimestamp is NULL OR lastAttemptTimestamp <= ${o??a-36e5})
      AND
        messageId IN (${t.vt(i)})
      AND
        ${c}
      -- for priority messages, let's load them oldest first; this helps, e.g. for stories where we
      -- want the oldest one first
      ORDER BY receivedAt ASC
      LIMIT ${n}
    `;s=e.prepare(r).all(l)}let l=n-s.length,u=[];if(l>0){let[n,r]=t.mt`
      SELECT * FROM attachment_downloads
      WHERE
        active = 0
      AND
        (retryAfter is NULL OR retryAfter <= ${a})
      AND
        ${c}
      ORDER BY receivedAt DESC
      LIMIT ${l}
    `;u=e.prepare(n).all(r)}let d=s.concat(u);try{return d.map(n=>{try{return t.ei(t.R,{...n,active:!!n.active,attachment:t.lt(n.attachmentJson)})}catch(t){throw V.error(`getNextAttachmentDownloadJobs: Error with job for message ${n.messageId}, deleting.`),hu(e,n),Error(t)}})}catch(t){if(`message`in t&&t.message===`jsonToObject or SchemaParse error`)return uu(e,{limit:n,prioritizeMessageIds:i,timestamp:a,maxLastAttemptForPrioritizedMessages:o});throw t}}function du(e,t){let n=[];if(e.transaction(()=>{for(let r of t)try{fu(e,r)}catch(e){n.push(e)}})(),n.length!==0)throw n.length===1?n[0]:AggregateError(n,`Multiple errors while saving attachment download jobs:\n ${n.map(e=>e.message).join(`
`)}`)}function fu(e,n){return e.transaction(()=>{let[r,i]=t.mt`
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE messages.id = ${n.messageId}
      );
    `;if(e.prepare(r,{pluck:!0}).get(i)!==1){V.warn(`saveAttachmentDownloadJob: message does not exist, bailing`);return}let a={messageId:n.messageId,attachmentType:n.attachmentType,attachmentSignature:n.attachmentSignature,receivedAt:n.receivedAt,sentAt:n.sentAt,contentType:n.contentType,size:n.size,active:+!!n.active,attempts:n.attempts,retryAfter:n.retryAfter,lastAttemptTimestamp:n.lastAttemptTimestamp,attachmentJson:t.ut(n.attachment),ciphertextSize:n.ciphertextSize,originalSource:n.originalSource,source:n.source};e.prepare(`
      INSERT INTO attachment_downloads
        (${go.join(`, `)})
      VALUES
        (${go.map(e=>`$${e}`).join(`, `)})
      ON CONFLICT DO UPDATE SET
          -- preserve originalSource
          ${go.filter(e=>e!==`originalSource`).map(e=>`${e} = $${e}`).join(`, `)}
    `).run(a)})()}function pu(e){e.prepare(`
    UPDATE attachment_downloads
    SET active = 0
    WHERE active != 0;
    `).run()}function mu(e){e.prepare(`
    UPDATE attachment_downloads
    SET retryAfter = NULL
    WHERE originalSource = 'backup_import'
    `).run()}function hu(e,n){let[r,i]=t.mt`
    DELETE FROM attachment_downloads
    WHERE
      messageId = ${n.messageId}
    AND
      attachmentType = ${n.attachmentType}
    AND
      attachmentSignature = ${n.attachmentSignature};
  `;e.prepare(r).run(i)}function gu(e,n){let[r,i]=t.mt`
    DELETE FROM attachment_downloads
    WHERE messageId = ${n}
  `;e.prepare(r).run(i)}function _u(e){e.prepare(`DELETE FROM attachment_backup_jobs;`).run()}function vu(e){e.prepare(`
    UPDATE attachment_backup_jobs
    SET active = 0;
    `).run()}function yu(e,n){let[r,i]=t.mt`
    INSERT OR REPLACE INTO attachment_backup_jobs (
      active,
      attempts,
      data,
      lastAttemptTimestamp,
      mediaName,
      receivedAt,
      retryAfter,
      type
    ) VALUES (
      ${+!!n.active},
      ${n.attempts},
      ${t.ut(n.data)},
      ${n.lastAttemptTimestamp},
      ${n.mediaName},
      ${n.receivedAt},
      ${n.retryAfter},
      ${n.type}
    );
  `;e.prepare(r).run(i)}function bu(e,{limit:n,timestamp:r=Date.now()}){let[i,a]=t.mt`
    SELECT * FROM attachment_backup_jobs
    WHERE
      active = 0
    AND
      (retryAfter is NULL OR retryAfter <= ${r})
    ORDER BY
      -- type is "standard" or "thumbnail"; we prefer "standard" jobs
      type ASC, receivedAt DESC
    LIMIT ${n}
  `;return e.prepare(i).all(a).map(n=>{let r=t.ii(bi,{...n,active:!!n.active,data:t.lt(n.data)});if(!r.success){let i=t.di(n.mediaName);return V.error(`getNextAttachmentBackupJobs: invalid data, removing. mediaName: ${i}`,t._i(r.error)),xu(e,{mediaName:n.mediaName}),null}return r.data}).filter(t.oi)}function xu(e,n){let[r,i]=t.mt`
    DELETE FROM attachment_backup_jobs
    WHERE
      mediaName = ${n.mediaName};
  `;e.prepare(r).run(i)}function Su(e){e.prepare(`DELETE FROM backup_cdn_object_metadata;`).run()}function Cu(e,n){e.transaction(()=>{for(let r of n){let{mediaId:n,cdnNumber:i,sizeOnBackupCdn:a}=r,[o,s]=t.mt`
        INSERT OR REPLACE INTO backup_cdn_object_metadata
        (
          mediaId,
          cdnNumber,
          sizeOnBackupCdn
        ) VALUES (
          ${n},
          ${i},
          ${a}
        );
      `;e.prepare(o).run(s)}})()}function wu(e,n){let[r,i]=t.mt`
    SELECT * FROM backup_cdn_object_metadata
    WHERE mediaId = ${n}
  `;return e.prepare(r).get(i)}function Tu(e,t){let{attemptedStatus:n,author:r,coverStickerId:i,createdAt:a,downloadAttempts:o,id:s,installedAt:c,key:l,lastUsed:u,status:d,stickerCount:f,title:p}=t;if(!s)throw Error(`createOrUpdateStickerPack: Provided data did not have a truthy id`);let m=e.prepare(`
      SELECT id
      FROM sticker_packs
      WHERE id = $id;
      `).get({id:s}),h={attemptedStatus:n??null,author:r,coverStickerId:i,createdAt:a||Date.now(),downloadAttempts:o||1,id:s,installedAt:c??null,key:l,lastUsed:u||null,status:d,stickerCount:f,title:p};if(m){e.prepare(`
      UPDATE sticker_packs SET
        attemptedStatus = $attemptedStatus,
        author = $author,
        coverStickerId = $coverStickerId,
        createdAt = $createdAt,
        downloadAttempts = $downloadAttempts,
        installedAt = $installedAt,
        key = $key,
        lastUsed = $lastUsed,
        status = $status,
        stickerCount = $stickerCount,
        title = $title
      WHERE id = $id;
      `).run(h);return}let{position:g}=t;z(g)||(g=e.prepare(`
    SELECT IFNULL(MAX(position) + 1, 0)
    FROM sticker_packs
    `,{pluck:!0}).get()),e.prepare(`
    INSERT INTO sticker_packs (
      attemptedStatus,
      author,
      coverStickerId,
      createdAt,
      downloadAttempts,
      id,
      installedAt,
      key,
      lastUsed,
      status,
      stickerCount,
      title,
      position
    ) values (
      $attemptedStatus,
      $author,
      $coverStickerId,
      $createdAt,
      $downloadAttempts,
      $id,
      $installedAt,
      $key,
      $lastUsed,
      $status,
      $stickerCount,
      $title,
      $position
    )
    `).run({...h,position:g??0})}function Eu(e,t){e.transaction(()=>{for(let n of t)Tu(e,n)})()}function Du(e,n,r,i){let a=i&&i.timestamp||Date.now(),o=r===`installed`?a:null;return e.transaction(()=>{let[i,a]=t.mt`
      SELECT status FROM sticker_packs WHERE id IS ${n};
    `,s=e.prepare(i,{pluck:!0}).get(a)??null,[c,l]=t.mt`
      UPDATE sticker_packs
      SET status = ${r}, installedAt = ${o}
      WHERE id IS ${n}
    `;return e.prepare(c).run(l),s})()}function Ou(e,{id:t,storageID:n,storageVersion:r,storageUnknownFields:i,storageNeedsSync:a,uninstalledAt:o,position:s}){o?e.prepare(`
      UPDATE uninstalled_sticker_packs
      SET
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync
      WHERE id = $id;
      `).run({id:t,storageID:n??null,storageVersion:r??null,storageUnknownFields:i??null,storageNeedsSync:+!!a}):e.prepare(`
      UPDATE sticker_packs
      SET
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync,
        position = $position
      WHERE id = $id;
      `).run({id:t,storageID:n??null,storageVersion:r??null,storageUnknownFields:i??null,storageNeedsSync:+!!a,position:s||0})}function ku(e){e.prepare(`
    UPDATE sticker_packs
    SET downloadAttempts = 0
    WHERE status = 'error';
    `).run()}function Au(e,t){let{emoji:n,height:r,id:i,isCoverOnly:a,lastUsed:o,packId:s,path:c,width:l,version:u,localKey:d,size:f}=t;if(!z(i))throw Error(`createOrUpdateSticker: Provided data did not have a numeric id`);if(!s)throw Error(`createOrUpdateSticker: Provided data did not have a truthy id`);e.prepare(`
    INSERT OR REPLACE INTO stickers (
      emoji,
      height,
      id,
      isCoverOnly,
      lastUsed,
      packId,
      path,
      width,
      version,
      localKey,
      size
    ) values (
      $emoji,
      $height,
      $id,
      $isCoverOnly,
      $lastUsed,
      $packId,
      $path,
      $width,
      $version,
      $localKey,
      $size
    )
    `).run({emoji:n??null,height:r,id:i,isCoverOnly:+!!a,lastUsed:o||null,packId:s,path:c,width:l,version:u||1,localKey:d||null,size:f||null})}function ju(e,t){e.transaction(()=>{for(let n of t)Au(e,n)})()}function Mu(e,t,n,r){e.prepare(`
    UPDATE stickers
    SET lastUsed = $lastUsed
    WHERE id = $id AND packId = $packId;
    `).run({id:n,packId:t,lastUsed:r}),e.prepare(`
    UPDATE sticker_packs
    SET lastUsed = $lastUsed
    WHERE id = $id;
    `).run({id:t,lastUsed:r})}function Nu(e,{messageId:n,packId:r,stickerId:i,isUnresolved:a}){if(!n)throw Error(`addStickerPackReference: Provided data did not have a truthy messageId`);if(!r)throw Error(`addStickerPackReference: Provided data did not have a truthy packId`);e.transaction(()=>{let[o,s]=t.mt`
      SELECT EXISTS (
        SELECT 1 FROM sticker_packs WHERE id IS ${r}
      )
    `;if(e.prepare(o,{pluck:!0}).get(s)!==1){V.warn(`addStickerPackReference: did not find referenced pack`);return}let[c,l]=t.mt`
      INSERT OR REPLACE INTO sticker_references (
        messageId,
        packId,
        stickerId,
        isUnresolved
      ) values (
        ${n},
        ${r},
        ${i},
        ${+!!a}
      )
    `;e.prepare(c).run(l)})()}function Pu(e,{messageId:t,packId:n}){return e.transaction(()=>{if(e.prepare(`
        DELETE FROM sticker_references
        WHERE messageId = $messageId AND packId = $packId;
        `).run({messageId:t,packId:n}),(e.prepare(`
      SELECT count(1) FROM sticker_references
      WHERE packId = $packId;
      `,{pluck:!0}).get({packId:n})??0)>0)return;let r=e.prepare(`
          SELECT status FROM sticker_packs
          WHERE id = $packId;
          `).get({packId:n});if(!r){V.warn(`deleteStickerPackReference: did not find referenced pack`);return}let{status:i}=r;if(i===`installed`)return;let a=e.prepare(`
          SELECT path FROM stickers
          WHERE packId = $packId;
          `).all({packId:n});return e.prepare(`
        DELETE FROM sticker_packs
        WHERE id = $packId;
        `).run({packId:n}),(a||[]).map(e=>e.path)})()}function Fu(e,n){return e.transaction(()=>{let[r,i]=t.mt`
      UPDATE sticker_references
      SET isUnresolved = 0
      WHERE packId IS ${n} AND isUnresolved IS 1
      RETURNING messageId, stickerId;
    `;return e.prepare(r).all(i).map(({messageId:e,stickerId:t})=>({messageId:e,packId:n,stickerId:t,isUnresolved:!0}))})()}function Iu(e,t){if(!t)throw Error(`deleteStickerPack: Provided data did not have a truthy packId`);return e.transaction(()=>{let n=e.prepare(`
          SELECT path FROM stickers
          WHERE packId = $packId;
          `).all({packId:t});return e.prepare(`
        DELETE FROM sticker_packs
        WHERE id = $packId;
        `).run({packId:t}),(n||[]).map(e=>e.path)})()}function Lu(e){return t.rt(e,`stickers`)}function Ru(e){return e.prepare(`
      SELECT * FROM sticker_packs
      ORDER BY position ASC, id ASC
      `).all().map(e=>({...e,storageNeedsSync:e.storageNeedsSync===1,stickers:{},author:String(e.author),title:String(e.title)}))}function zu(e,t){e.prepare(`
      INSERT OR REPLACE INTO uninstalled_sticker_packs
      (
        id, uninstalledAt, storageID, storageVersion, storageUnknownFields,
        storageNeedsSync
      )
      VALUES
      (
        $id, $uninstalledAt, $storageID, $storageVersion, $unknownFields,
        $storageNeedsSync
      )
    `).run({id:t.id,uninstalledAt:t.uninstalledAt,storageID:t.storageID??null,storageVersion:t.storageVersion??null,unknownFields:t.storageUnknownFields??null,storageNeedsSync:+!!t.storageNeedsSync})}function Bu(e,t){return e.transaction(()=>{for(let n of t)zu(e,n)})()}function Vu(e,n){let[r,i]=t.mt`
    DELETE FROM uninstalled_sticker_packs WHERE id IS ${n}
  `;e.prepare(r).run(i)}function Hu(e){return e.prepare(`SELECT * FROM uninstalled_sticker_packs ORDER BY id ASC`).all().map(e=>({...e,storageNeedsSync:e.storageNeedsSync===1}))}function Uu(e){return e.prepare(`
      SELECT *
      FROM sticker_packs
      WHERE
        status IS 'installed' OR
        storageID IS NOT NULL
      ORDER BY id ASC
      `).all().map(e=>({...e,storageNeedsSync:e.storageNeedsSync===1,stickers:{}}))}function Wu(e,t){return e.transaction(()=>{let n=e.prepare(`
        SELECT * FROM uninstalled_sticker_packs
        WHERE id IS $packId
        `).get({packId:t});if(n)return{...n,storageNeedsSync:n.storageNeedsSync===1,key:void 0,position:void 0};let r=e.prepare(`
        SELECT
          id, key, position, storageID, storageVersion, storageUnknownFields
        FROM sticker_packs
        WHERE id IS $packId
        `).get({packId:t});if(r)return{...r,storageNeedsSync:r.storageNeedsSync===1,uninstalledAt:void 0}})()}function Gu(e,n,r){return e.transaction(()=>{Vu(e,n);let i=Du(e,n,`installed`,{timestamp:r})!==`installed`;if(i){let[r,i]=t.mt`
        UPDATE sticker_packs SET
          storageNeedsSync = 1
        WHERE id IS ${n};
      `;e.prepare(r).run(i)}return i})()}function Ku(e,n,r){return e.transaction(()=>{let i=Du(e,n,`downloaded`)===`installed`,[a,o]=t.mt`
      UPDATE sticker_packs SET
        storageID = NULL,
        storageVersion = NULL,
        storageUnknownFields = NULL,
        storageNeedsSync = 0
      WHERE id = ${n}
    `;return e.prepare(a).run(o),zu(e,{id:n,uninstalledAt:r,storageNeedsSync:i}),i})()}function qu(e){return(e.prepare(`
      SELECT * FROM stickers
      ORDER BY packId ASC, id ASC
      `).all()||[]).map(e=>bo(e))}function Ju(e,{limit:t}={}){return(e.prepare(`
      SELECT stickers.* FROM stickers
      JOIN sticker_packs on stickers.packId = sticker_packs.id
      WHERE stickers.lastUsed > 0 AND sticker_packs.status = 'installed'
      ORDER BY stickers.lastUsed DESC
      LIMIT $limit
      `).all({limit:t||24})||[]).map(e=>bo(e))}function Yu(e,n){let[r,i]=t.mt`
    INSERT OR REPLACE INTO recentEmojis (
      emoji,
      lastUsedAt
    ) VALUES (
      ${n},
      ${Date.now()}
    )
  `;e.prepare(r).run(i)}function Xu(e,n){let[r,i]=t.mt`
    SELECT emoji FROM recentEmojis
    ORDER BY lastUsedAt DESC
    LIMIT ${n}
  `;return e.prepare(r,{pluck:!0}).all(i)}const Zu=t.Ri({id:t.Vi(),title:t.Vi(),description:t.Vi(),previewMedia_url:t.Vi(),previewMedia_width:t.Li().int(),previewMedia_height:t.Li().int(),attachmentMedia_url:t.Vi(),attachmentMedia_width:t.Li().int(),attachmentMedia_height:t.Li().int(),lastUsedAt:t.Li().int()});function Qu(e,n){let[r,i]=t.mt`
    SELECT * FROM recentGifs
    ORDER BY lastUsedAt DESC
    LIMIT ${n}
  `;return e.prepare(r).all(i).map(e=>{let n=t.ei(Zu,e);return{id:n.id,title:n.title,description:n.description,previewMedia:{url:n.previewMedia_url,width:n.previewMedia_width,height:n.previewMedia_height},attachmentMedia:{url:n.attachmentMedia_url,width:n.attachmentMedia_width,height:n.attachmentMedia_height}}})}function $u(e,n,r,i){let[a,o]=t.mt`
    INSERT OR REPLACE INTO recentGifs (
      id,
      title,
      description,
      previewMedia_url,
      previewMedia_width,
      previewMedia_height,
      attachmentMedia_url,
      attachmentMedia_width,
      attachmentMedia_height,
      lastUsedAt
    ) VALUES (
      ${n.id},
      ${n.title},
      ${n.description},
      ${n.previewMedia.url},
      ${n.previewMedia.width},
      ${n.previewMedia.height},
      ${n.attachmentMedia.url},
      ${n.attachmentMedia.width},
      ${n.attachmentMedia.height},
      ${r}
    );
  `,[s,c]=t.mt`
    DELETE FROM recentGifs
    WHERE id NOT IN (
      SELECT id FROM recentGifs
      ORDER BY lastUsedAt DESC
      LIMIT ${i}
    );
  `;e.transaction(()=>{e.prepare(a).run(o),e.prepare(s).run(c)})()}function ed(e,n){let[r,i]=t.mt`
    DELETE FROM recentGifs
    WHERE id = ${n}
  `;e.prepare(r).run(i)}function td(e){return e.transaction(()=>{let n=e.prepare(`SELECT * FROM badges`).all(),r=e.prepare(`SELECT * FROM badgeImageFiles`).all(),a=new Map;for(let e of r){let{badgeId:n,order:r,localPath:o,url:s,theme:c}=e,l=a.get(n)||[];l[r]={...l[r],[i.Kn(c)]:{localPath:t.u(o),url:s}},a.set(n,l)}return n.map(e=>({id:e.id,category:i.Jn(e.category),name:e.name,descriptionTemplate:e.descriptionTemplate,images:(a.get(e.id)||[]).filter(t.oi)}))})()}function nd(e,t){let n=e.prepare(`
    INSERT OR REPLACE INTO badges (
      id,
      category,
      name,
      descriptionTemplate
    ) VALUES (
      $id,
      $category,
      $name,
      $descriptionTemplate
    );
    `),r=e.prepare(`SELECT url, localPath FROM badgeImageFiles WHERE badgeId = $badgeId`),i=e.prepare(`
    INSERT INTO badgeImageFiles (
      badgeId,
      'order',
      url,
      localPath,
      theme
    ) VALUES (
      $badgeId,
      $order,
      $url,
      $localPath,
      $theme
    );
    `);e.transaction(()=>{t.forEach(e=>{let{id:t}=e,a=new Map;for(let{url:e,localPath:n}of r.all({badgeId:t}))n&&a.set(e,n);n.run({id:t,category:e.category,name:e.name,descriptionTemplate:e.descriptionTemplate});for(let[n,r]of e.images.entries())for(let[e,o]of Object.entries(r))i.run({badgeId:t,localPath:o.localPath||a.get(o.url)||null,order:n,theme:e,url:o.url})})})()}function rd(e,t,n){e.prepare(`UPDATE badgeImageFiles SET localPath = $localPath WHERE url = $url`).run({url:t,localPath:n})}function id(e){let t=e.prepare(`SELECT localPath FROM badgeImageFiles WHERE localPath IS NOT NULL`,{pluck:!0}).all();return new Set(t)}function ad(e,n=!1){let r=!0;try{let t=e.pragma(`integrity_check`);t.length===1&&t.at(0)?.integrity_check===`ok`?V.info(`runCorruptionChecks: general integrity is ok`):(V.error(`runCorruptionChecks: general integrity is not ok`,t),r=!1)}catch(e){V.error(`runCorruptionChecks: general integrity check error`,t._i(e)),r=!1}try{e.exec(`INSERT INTO messages_fts(messages_fts) VALUES('integrity-check')`),V.info(`runCorruptionChecks: FTS5 integrity ok`)}catch(i){if(V.error(`runCorruptionChecks: FTS5 integrity check error.`,t._i(i)),r=!1,!n){try{e.exec(`INSERT INTO messages_fts(messages_fts) VALUES('rebuild');`),V.info(`runCorruptionChecks: FTS5 index rebuilt`)}catch(e){return V.error(`runCorruptionChecks: FTS5 recovery failed`,t._i(e)),!1}return V.info(`runCorruptionChecks: retrying`),ad(e,!0)}}return r}function od(e){return{...B(e,`senderKeyInfoJson`),allowsReplies:!!e.allowsReplies,deletedAtTimestamp:e.deletedAtTimestamp||void 0,isBlockList:!!e.isBlockList,senderKeyInfo:e.senderKeyInfoJson?JSON.parse(e.senderKeyInfoJson):void 0,storageID:e.storageID||void 0,storageVersion:e.storageVersion||void 0,storageNeedsSync:!!e.storageNeedsSync,storageUnknownFields:e.storageUnknownFields||void 0}}function sd(e){return{...B(e,`senderKeyInfo`),allowsReplies:+!!e.allowsReplies,deletedAtTimestamp:e.deletedAtTimestamp||null,isBlockList:+!!e.isBlockList,senderKeyInfoJson:e.senderKeyInfo?JSON.stringify(e.senderKeyInfo):null,storageID:e.storageID||null,storageVersion:e.storageVersion||null,storageNeedsSync:+!!e.storageNeedsSync,storageUnknownFields:e.storageUnknownFields||null}}function cd(e){return e.prepare(`SELECT * FROM storyDistributions;`).all().map(od)}function ld(e){return e.prepare(`SELECT * FROM storyDistributionMembers;`).all()}function ud(e){e.prepare(`DELETE FROM storyDistributions;`).run()}function dd(e,n){t.Yr(n.name,`Distribution list does not have a valid name`),e.transaction(()=>{let t=sd(n);e.prepare(`
      INSERT INTO storyDistributions(
        id,
        name,
        deletedAtTimestamp,
        allowsReplies,
        isBlockList,
        senderKeyInfoJson,
        storageID,
        storageVersion,
        storageUnknownFields,
        storageNeedsSync
      ) VALUES (
        $id,
        $name,
        $deletedAtTimestamp,
        $allowsReplies,
        $isBlockList,
        $senderKeyInfoJson,
        $storageID,
        $storageVersion,
        $storageUnknownFields,
        $storageNeedsSync
      );
      `).run(t);let{id:r,members:i}=n,a=e.prepare(`
      INSERT OR REPLACE INTO storyDistributionMembers (
        listId,
        serviceId
      ) VALUES (
        $listId,
        $serviceId
      );
      `);for(let e of i)a.run({listId:r,serviceId:e})})()}function fd(e){let t=cd(e),n=io(ld(e),e=>e.listId);return t.map(e=>({...e,members:(n[e.id]||[]).map(e=>e.serviceId)}))}function pd(e,t){let n=e.prepare(`SELECT * FROM storyDistributions WHERE id = $id;`).get({id:t});if(!n)return;let r=e.prepare(`SELECT serviceId FROM storyDistributionMembers WHERE listId = $id;`).all({id:t});return{...od(n),members:r.map(({serviceId:e})=>e)}}function md(e,n){let r=sd(n);r.deletedAtTimestamp?t.Yr(!r.name,`Attempt to delete distribution list but still has a name`):t.Yr(r.name,`Cannot clear distribution list name without deletedAtTimestamp set`),e.prepare(`
    UPDATE storyDistributions
    SET
      name = $name,
      deletedAtTimestamp = $deletedAtTimestamp,
      allowsReplies = $allowsReplies,
      isBlockList = $isBlockList,
      senderKeyInfoJson = $senderKeyInfoJson,
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE id = $id
    `).run(r)}function hd(e,n,{toAdd:r,toRemove:i}){let a=e.prepare(`
    INSERT OR REPLACE INTO storyDistributionMembers (
      listId,
      serviceId
    ) VALUES (
      $listId,
      $serviceId
    );
    `);for(let e of r)a.run({listId:n,serviceId:e});t.X(e,i,(r,i)=>{let[a,o]=t.mt`
        DELETE FROM storyDistributionMembers
        WHERE listId = ${n} AND serviceId IN (${t.vt(r)});
      `;e.prepare(a,{persistent:i}).run(o)})}function gd(e,t,{toAdd:n,toRemove:r}){n.length||r.length?e.transaction(()=>{md(e,t),hd(e,t.id,{toAdd:n,toRemove:r})})():md(e,t)}function _d(e,t){e.prepare(`DELETE FROM storyDistributions WHERE id = $id;`).run({id:t})}function vd(e){return e.prepare(`SELECT * FROM storyReads;`).all()}function yd(e){e.prepare(`DELETE FROM storyReads;`).run()}function bd(e,t){e.prepare(`
    INSERT OR REPLACE INTO storyReads(
      authorId,
      conversationId,
      storyId,
      storyReadDate
    ) VALUES (
      $authorId,
      $conversationId,
      $storyId,
      $storyReadDate
    );
    `).run(t)}function xd(e,{authorId:t,conversationId:n,limit:r}){let i=r||5;return e.prepare(`
      SELECT * FROM storyReads
      WHERE
        authorId = $authorId AND
        ($conversationId IS NULL OR conversationId = $conversationId)
      ORDER BY storyReadDate DESC
      LIMIT $limit;
      `).all({authorId:t,conversationId:n||null,limit:i})}function Sd(e,t){return e.prepare(`
      SELECT count(1) FROM storyReads
      WHERE conversationId = $conversationId;
      `,{pluck:!0}).get({conversationId:t})??0}function Cd(e){return{...B(e,[`allowedMembersJson`,`scheduleDaysEnabledJson`]),emoji:e.emoji??void 0,allowAllCalls:!!e.allowAllCalls,allowAllMentions:!!e.allowAllMentions,scheduleEnabled:!!e.scheduleEnabled,allowedMembers:e.allowedMembersJson?new Set(JSON.parse(e.allowedMembersJson)):new Set,scheduleStartTime:e.scheduleStartTime||void 0,scheduleEndTime:e.scheduleEndTime||void 0,scheduleDaysEnabled:e.scheduleDaysEnabledJson?JSON.parse(e.scheduleDaysEnabledJson):void 0,deletedAtTimestampMs:e.deletedAtTimestampMs||void 0,storageID:e.storageID||void 0,storageVersion:e.storageVersion||void 0,storageNeedsSync:!!e.storageNeedsSync,storageUnknownFields:e.storageUnknownFields||void 0}}function wd(e){return{...B(e,[`allowedMembers`,`scheduleDaysEnabled`]),emoji:e.emoji||null,allowAllCalls:+!!e.allowAllCalls,allowAllMentions:+!!e.allowAllMentions,scheduleEnabled:+!!e.scheduleEnabled,allowedMembersJson:e.allowedMembers?JSON.stringify(Array.from(e.allowedMembers)):null,scheduleStartTime:e.scheduleStartTime||null,scheduleEndTime:e.scheduleEndTime||null,scheduleDaysEnabledJson:e.scheduleDaysEnabled?JSON.stringify(e.scheduleDaysEnabled):null,deletedAtTimestampMs:e.deletedAtTimestampMs||null,storageID:e.storageID||null,storageVersion:e.storageVersion||null,storageNeedsSync:+!!e.storageNeedsSync,storageUnknownFields:e.storageUnknownFields||null}}function Td(e){return e.prepare(`SELECT * FROM notificationProfiles ORDER BY createdAtMs DESC;`).all().map(Cd)}function Ed(e,n){let[r,i]=t.mt`SELECT * FROM notificationProfiles WHERE id = ${n}`,a=e.prepare(r).get(i);if(a)return Cd(a)}function Dd(e){e.prepare(`DELETE FROM notificationProfiles;`).run()}function Od(e,n){let[r,i]=t.mt`DELETE FROM notificationProfiles WHERE id = ${n}`;e.prepare(r).run(i)}function kd(e,n){let[r,i]=t.mt`
      UPDATE notificationProfiles
      SET
        deletedAtTimestampMs = ${new Date().getTime()},
        storageNeedsSync = 1
      WHERE
        id = ${n} AND
        deletedAtTimestampMs IS NULL
      RETURNING deletedAtTimestampMs`;return e.prepare(r).get(i)?.deletedAtTimestampMs}function Ad(e,n){t.Yr(n.name,`Notification profile does not have a valid name`);let r=wd(n);e.prepare(`
      INSERT INTO notificationProfiles(
        id,
        name,
        emoji,
        color,
        createdAtMs,
        allowAllCalls,
        allowAllMentions,
        allowedMembersJson,
        scheduleEnabled,
        scheduleStartTime,
        scheduleEndTime,
        scheduleDaysEnabledJson,
        deletedAtTimestampMs,
        storageID,
        storageVersion,
        storageUnknownFields,
        storageNeedsSync
      ) VALUES (
        $id,
        $name,
        $emoji,
        $color,
        $createdAtMs,
        $allowAllCalls,
        $allowAllMentions,
        $allowedMembersJson,
        $scheduleEnabled,
        $scheduleStartTime,
        $scheduleEndTime,
        $scheduleDaysEnabledJson,
        $deletedAtTimestampMs,
        $storageID,
        $storageVersion,
        $storageUnknownFields,
        $storageNeedsSync
      );
      `).run(r)}function jd(e,n){t.Yr(n.name,`Notification profile does not have a valid name`),e.transaction(()=>{let t=wd(n);e.prepare(`
      UPDATE notificationProfiles SET
        name = $name,
        emoji = $emoji,
        color = $color,
        createdAtMs = $createdAtMs,
        allowAllCalls = $allowAllCalls,
        allowAllMentions = $allowAllMentions,
        allowedMembersJson = $allowedMembersJson,
        scheduleEnabled = $scheduleEnabled,
        scheduleStartTime = $scheduleStartTime,
        scheduleEndTime = $scheduleEndTime,
        scheduleDaysEnabledJson = $scheduleDaysEnabledJson,
        deletedAtTimestampMs = $deletedAtTimestampMs,
        storageID = $storageID,
        storageVersion = $storageVersion,
        storageUnknownFields = $storageUnknownFields,
        storageNeedsSync = $storageNeedsSync
      WHERE
        id = $id;
      `).run(t)})()}function Md(e){e.transaction(()=>{e.exec(`
      --- Remove messages delete trigger for performance
      DROP   TRIGGER messages_on_delete;

      DELETE FROM attachment_downloads;
      DELETE FROM attachment_backup_jobs;
      DELETE FROM attachment_downloads_backup_stats;
      DELETE FROM attachments_protected_from_deletion;
      DELETE FROM backup_cdn_object_metadata;
      DELETE FROM badgeImageFiles;
      DELETE FROM badges;
      DELETE FROM callLinks;
      DELETE FROM callsHistory;
      DELETE FROM chatFolders;
      DELETE FROM conversations;
      DELETE FROM defunctCallLinks;
      DELETE FROM donationReceipts;
      DELETE FROM groupCallRingCancellations;
      DELETE FROM groupSendCombinedEndorsement;
      DELETE FROM groupSendMemberEndorsement;
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM jobs;
      DELETE FROM key_transparency_account_data;
      DELETE FROM kyberPreKeys;
      DELETE FROM megaphones;
      DELETE FROM message_attachments;
      DELETE FROM messages_fts;
      DELETE FROM messages;
      DELETE FROM notificationProfiles;
      DELETE FROM pinnedMessages;
      DELETE FROM preKeys;
      DELETE FROM reactions;
      DELETE FROM recentEmojis;
      DELETE FROM recentGifs;
      DELETE FROM senderKeys;
      DELETE FROM sendLogMessageIds;
      DELETE FROM sendLogPayloads;
      DELETE FROM sendLogRecipients;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM sticker_packs;
      DELETE FROM sticker_references;
      DELETE FROM stickers;
      DELETE FROM storyDistributionMembers;
      DELETE FROM storyDistributions;
      DELETE FROM storyReads;
      DELETE FROM syncTasks;
      DELETE FROM unprocessed;
      DELETE FROM uninstalled_sticker_packs;

      INSERT INTO messages_fts(messages_fts) VALUES('optimize');


      --- Re-create the messages delete trigger
      --- See migration 45
      CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE rowid = old.rowid;
        DELETE FROM sendLogPayloads WHERE id IN (
          SELECT payloadId FROM sendLogMessageIds
          WHERE messageId = old.id
        );
        DELETE FROM reactions WHERE rowid IN (
          SELECT rowid FROM reactions
          WHERE messageId = old.id
        );
        DELETE FROM storyReads WHERE storyId = old.storyId;
      END;
    `),cu(e)})()}function Nd(e,n){e.transaction(()=>{e.exec(`
      DELETE FROM attachment_backup_jobs;
      DELETE FROM attachment_downloads;
      DELETE FROM backup_cdn_object_metadata;
      DELETE FROM groupSendCombinedEndorsement;
      DELETE FROM groupSendMemberEndorsement;
      DELETE FROM jobs;
      DELETE FROM key_transparency_account_data;
      DELETE FROM kyberPreKeys;
      DELETE FROM preKeys;
      DELETE FROM senderKeys;
      DELETE FROM sendLogMessageIds;
      DELETE FROM sendLogPayloads;
      DELETE FROM sendLogRecipients;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM syncTasks;
      DELETE FROM unprocessed;
      `);let r=e.prepare(`SELECT id FROM items`,{pluck:!0}).all(),i=new Set(h);n&&(i=i.union(new Set(g)));for(let n of r)i.has(n)||t.ft(e,`items`,n);e.exec(`
        UPDATE storyDistributions SET senderKeyInfoJson = NULL;
      `);let[a,o]=t.mt`
      UPDATE conversations
      SET
        expireTimerVersion = ${1},
        json = json_remove(
          json,
          '$.senderKeyInfo',
          '$.storageID',
          '$.needsStorageServiceSync',
          '$.storageUnknownFields',
          '$.expireTimerVersion'
        );
    `;e.prepare(a).run(o)})()}function Pd(e){e.exec(`
    -- Conversations
    UPDATE conversations
    SET
      json = json_remove(json, '$.storageID', '$.needsStorageServiceSync', '$.storageUnknownFields');

    -- Stickers
    UPDATE sticker_packs
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    UPDATE uninstalled_sticker_packs
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    -- Story Distribution Lists
    UPDATE storyDistributions
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    -- Call links
    UPDATE callLinks
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    -- Chat Folders
    UPDATE chatFolders
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;

    -- Notification Profiles
    UPDATE notificationProfiles
    SET
      storageID = null,
      storageVersion = null,
      storageUnknownFields = null,
      storageNeedsSync = 0;
  `)}function Fd(e,n,{maxVersion:r}){return e.transaction(()=>N(e,e.prepare(`
      SELECT ${t.W.join(`, `)}
      FROM messages
      WHERE
        (schemaVersion IS NULL OR schemaVersion < $maxVersion) AND
        IFNULL(
          json_extract(json, '$.schemaMigrationAttempts'),
          0
        ) < $maxAttempts
      LIMIT $limit;
      `).all({maxVersion:r,maxAttempts:5,limit:n})))()}function Id(e,n){t.X(e,n,(n,r)=>{let[i,a]=t.mt`
        UPDATE
          messages
        SET
          json = json_set(
            json,
            '$.schemaMigrationAttempts',
            IFNULL(json -> '$.schemaMigrationAttempts', 0) + 1
          )
        WHERE
          id IN (${t.vt(n)})
      `;e.prepare(i,{persistent:r}).run(a)})}function Ld(e,t,n){return n==null?e.prepare(`
    SELECT DISTINCT serverGuid
    FROM messages
    WHERE conversationId = $conversationId
    AND type IS NOT 'outgoing'
    AND serverGuid IS NOT NULL
    ORDER BY received_at DESC, sent_at DESC
    LIMIT $limit;
    `,{pluck:!0}).all({conversationId:t,limit:3}):e.prepare(`
    SELECT DISTINCT serverGuid
    FROM messages
    WHERE conversationId = $conversationId
    AND sourceServiceId = $sourceServiceId
    AND type IS NOT 'outgoing'
    AND serverGuid IS NOT NULL
    ORDER BY received_at DESC, sent_at DESC
    LIMIT $limit;
    `,{pluck:!0}).all({conversationId:t,sourceServiceId:n,limit:3})}function Rd(e){let{avatar:t,profileAvatar:n}=e,r=[];return t&&t.path&&r.push(t.path),n&&n.path&&r.push(n.path),r}function zd(e){let t=e.draftAttachments||[],n=[];return no(t,e=>{if(e.pending)return;let{path:t,screenshotPath:r}=e;t&&n.push(t),r&&n.push(r)}),n}function Bd(e,t){let n=t,r=new Set,a=new Set,{messages:o,cursor:s}=Hd(e,n);for(let e of o){let{externalAttachments:t,externalDownloads:n}=i.d(e);t.forEach(e=>r.add(e)),n.forEach(e=>a.add(e))}return{attachments:Array.from(r),downloads:Array.from(a),cursor:s}}function Vd(e,t){Ud(e,t)}function Hd(e,n){let r=No(e,`only temp table use`),i=1e3;return r.transaction(()=>{let a=n?.count??0;t.Yr(!n?.done,`pageMessages: iteration cannot be restarted`);let s;if(n===void 0){s=(0,o.randomBytes)(8).toString(`hex`);let t=$s(e);V.info(`pageMessages(${s}): Starting iteration through ${t} messages`),r.exec(`
        CREATE TEMP TABLE tmp_${s}_updated_messages
          (rowid INTEGER PRIMARY KEY, received_at INTEGER, sent_at INTEGER);

        CREATE INDEX tmp_${s}_updated_messages_received_at
          ON tmp_${s}_updated_messages (received_at ASC, sent_at ASC);

        INSERT INTO tmp_${s}_updated_messages
          (rowid, received_at, sent_at)
          SELECT rowid, received_at, sent_at FROM messages
          ORDER BY received_at ASC, sent_at ASC;

        CREATE TEMP TRIGGER tmp_${s}_message_updates
        UPDATE OF json ON messages
        BEGIN
          INSERT OR IGNORE INTO tmp_${s}_updated_messages
          (rowid, received_at, sent_at)
          VALUES (NEW.rowid, NEW.received_at, NEW.sent_at);
        END;

        CREATE TEMP TRIGGER tmp_${s}_message_inserts
        AFTER INSERT ON messages
        BEGIN
          INSERT OR IGNORE INTO tmp_${s}_updated_messages
          (rowid, received_at, sent_at)
          VALUES (NEW.rowid, NEW.received_at, NEW.sent_at);
        END;
        `)}else ({runId:s}=n);let c=r.prepare(`
      DELETE FROM tmp_${s}_updated_messages
      RETURNING rowid
      ORDER BY received_at ASC, sent_at ASC
      LIMIT $chunkSize;
    `,{pluck:!0}).all({chunkSize:i}),l=t.X(r,c,(n,i)=>N(e,r.prepare(`
          SELECT ${t.W.join(`, `)}
          FROM messages
          WHERE rowid IN (${Array(n.length).fill(`?`).join(`,`)});
          `,{persistent:i}).all(n)));a+=l.length;let u=c.length<i;return{messages:l,cursor:{runId:s,count:a,done:u}}})()}function Ud(e,{runId:t,count:n,done:r}){let i=No(e,`only temp table use`),a=`finishPageMessages(${t})`;r||V.warn(`${a}: iteration not finished`),V.info(`${a}: reached the end after processing ${n} messages`),i.exec(`
    DROP TABLE tmp_${t}_updated_messages;
    DROP TRIGGER tmp_${t}_message_updates;
    DROP TRIGGER tmp_${t}_message_inserts;
  `)}function Wd(e,n){let r=1e3,[i,a]=t.mt`
    SELECT
      rowid,
      ${t.G}
    FROM messages
    WHERE
      rowid >= ${n?.nextRowid??0}
    LIMIT ${r}
  `,o=e.prepare(i).all(a);return{cursor:{nextRowid:o.at(-1)?.rowid??0,done:o.length<r},messages:N(e,o)}}function Gd(e){let t=[],n=ds(e,`backupDownloadPath`);return n&&t.push(n.value),t}function Kd(e){let n=new Set,r=!1,i=``,a=Bs(e);V.info(`getKnownConversationAttachments: About to iterate through ${a}`);let o=e.prepare(`
      SELECT json FROM conversations
      WHERE id > $id
      ORDER BY id ASC
      LIMIT $chunkSize;
    `);for(;!r;){let e=lo(o.all({id:i,chunkSize:500}),e=>t.lt(e.json));e.forEach(e=>{Rd(e).forEach(e=>n.add(e))});let a=co(e);a&&({id:i}=a),r=e.length<500}return V.info(`getKnownConversationAttachments: Done processing`),Array.from(n)}function qd(e,t){let n=ro(lo(t,e=>[e,!0])),r=Lu(e);V.info(`removeKnownStickers: About to iterate through ${r} stickers`);let i=0,a=!1,o=0;for(;!a;){let t=e.prepare(`
        SELECT rowid, path FROM stickers
        WHERE rowid > $rowid
        ORDER BY rowid ASC
        LIMIT $chunkSize;
        `).all({rowid:o,chunkSize:50});t.map(e=>e.path).forEach(e=>{delete n[e]});let r=co(t);r&&({rowid:o}=r),a=t.length<50,i+=t.length}return V.info(`removeKnownStickers: Done processing ${i} stickers`),Object.keys(n)}function Jd(e,n){let r=ro(lo(n,e=>[e,!0])),i=Bs(e);V.info(`removeKnownDraftAttachments: About to iterate through ${i} conversations`);let a=!1,o=0,s=0;for(;!a;){let n=e.prepare(`
        SELECT json FROM conversations
        WHERE id > $id
        ORDER BY id ASC
        LIMIT $chunkSize;
        `).all({id:s,chunkSize:50}).map(e=>t.lt(e.json));n.forEach(e=>{zd(e).forEach(e=>{delete r[e]})});let i=co(n);i&&({id:s}=i),a=n.length<50,o+=n.length}return V.info(`removeKnownDraftAttachments: Done processing ${o} conversations`),Object.keys(r)}function Yd(e,n){return e.prepare(`
      SELECT id, timestamp, data
      FROM jobs
      WHERE queueType = $queueType
      ORDER BY timestamp;
      `).all({queueType:n}).map(e=>({id:e.id,queueType:n,timestamp:e.timestamp,data:t.oi(e.data)?JSON.parse(e.data):void 0}))}function X(e,n){e.prepare(`
      INSERT INTO jobs
      (id, queueType, timestamp, data)
      VALUES
      ($id, $queueType, $timestamp, $data);
    `).run({id:n.id,queueType:n.queueType,timestamp:n.timestamp,data:t.oi(n.data)?JSON.stringify(n.data):null})}function Xd(e,t){e.prepare(`DELETE FROM jobs WHERE id = $id`).run({id:t})}function Zd(e,t){return e.prepare(`
  SELECT EXISTS (
    SELECT 1 FROM groupCallRingCancellations
    WHERE ringId = $ringId
    AND createdAt >= $ringsOlderThanThisAreIgnored
  );
  `,{pluck:!0,bigint:!0}).get({ringId:t,ringsOlderThanThisAreIgnored:Date.now()-$d})===1n}function Qd(e,t){e.prepare(`
    INSERT INTO groupCallRingCancellations (ringId, createdAt)
    VALUES ($ringId, $createdAt)
    ON CONFLICT (ringId) DO NOTHING;
    `,{bigint:!0}).run({ringId:t,createdAt:Date.now()})}const $d=30*t.Rt;function ef(e){e.prepare(`
    DELETE FROM groupCallRingCancellations
    WHERE createdAt < $expiredRingTime;
    `).run({expiredRingTime:Date.now()-$d})}function tf(e){return e.prepare(`
SELECT MAX(counter)
FROM
  (
    SELECT MAX(received_at) AS counter FROM messages
    UNION
    SELECT MAX(timestamp) AS counter FROM unprocessed
  )
`,{pluck:!0}).get()}function nf(e){return uo({messageCount:$s(e),conversationCount:Bs(e),sessionCount:t.rt(e,`sessions`),senderKeyCount:t.rt(e,`senderKeys`)},i.Zn)}function rf(e,t,n){e.prepare(`
    UPDATE conversations
    SET json = JSON_PATCH(json, $patch);
    `).run({patch:JSON.stringify({conversationColor:t||null,customColor:n?.value||null,customColorId:n?.id||null})})}function af(e){e.exec(`
    UPDATE conversations
    SET
      json = json_remove(json, '$.profileKeyCredential')
    `)}function of(e,n,r,i){e.transaction(()=>{yc(e,n,{ourAci:r,alreadyInTransaction:!0});try{for(let{conversationId:n,messageId:r,readStatus:a,sentAt:o}of i){let[i,s]=t.mt`
        INSERT INTO edited_messages (
          conversationId,
          messageId,
          sentAt,
          readStatus
        ) VALUES (
          ${n},
          ${r},
          ${o},
          ${a??null}
        );
      `;e.prepare(i).run(s)}}catch(r){let[i,a]=t.mt`
        SELECT EXISTS(
          SELECT 1 FROM messages
          WHERE messages.id = ${n.id}
        );
      `;if(e.prepare(i,{pluck:!0}).get(a)!==1)V.warn(`saveEditedMessages: save failed because message does not exist`);else throw r}})()}function sf(e,t,n,r){return of(e,t,n,[r])}function cf(e){return e.prepare(`
      SELECT * FROM edited_messages;
      `).all({})}function lf(e,{conversationId:n,readMessageReceivedAt:r}){return e.transaction(()=>{let[a,o]=t.mt`
      SELECT
        ${t.vt(t.W.filter(e=>e!==`sent_at`&&e!==`readStatus`).map(e=>t.gt`messages.${t._t(e)}`))},
        edited_messages.sentAt as sent_at,
        edited_messages.readStatus
      FROM edited_messages
      JOIN messages
        ON messages.id = edited_messages.messageId
      WHERE
        edited_messages.readStatus = ${i.Z.Unread} AND
        edited_messages.conversationId = ${n} AND
        messages.received_at <= ${r}
      ORDER BY messages.received_at DESC, messages.sent_at DESC;
    `,s=e.prepare(a).all(o),[c]=s;if(c!=null){let r=c.sent_at,[a,o]=t.mt`
        UPDATE edited_messages
          SET
            readStatus = ${i.Z.Read}
          WHERE
            readStatus = ${i.Z.Unread} AND
            conversationId = ${n} AND
            sentAt <= ${r};
      `;e.prepare(a).run(o)}return N(e,s).map(e=>({originalReadStatus:e.readStatus??void 0,readStatus:i.Z.Read,seenStatus:i.D.Seen,...mo(e,[`conversationId`,`expirationStartTimestamp`,`id`,`received_at`,`sent_at`,`source`,`sourceServiceId`,`timestamp`,`type`])}))})()}function uf(e){let[n,r]=t.mt`
    SELECT schemaVersion, COUNT(1) as count from messages
    GROUP BY schemaVersion;
  `;return e.prepare(n).all(r).sort((e,t)=>e.schemaVersion-t.schemaVersion)}function df(e,n){return e.transaction(()=>{let[r,i]=t.mt`
      SELECT * from messages
      WHERE schemaVersion = ${n}
      ORDER BY RANDOM()
      LIMIT 2;
    `;return N(e,e.prepare(r).all(i))})()}function ff(e){e.transaction(()=>{us(e,{id:`messageInsertTriggersDisabled`,value:!0}),e.exec(`DROP TRIGGER IF EXISTS messages_on_insert;`),e.exec(`DROP TRIGGER IF EXISTS messages_on_insert_insert_mentions;`)})()}const pf=`
  SELECT messages.id, bodyRanges.value ->> 'mentionAci' as mentionAci,
    bodyRanges.value ->> 'start' as start,
    bodyRanges.value ->> 'length' as length
  FROM messages, json_each(messages.json ->> 'bodyRanges') as bodyRanges
  WHERE bodyRanges.value ->> 'mentionAci' IS NOT NULL
`;function mf(e){e.pragma(`checkpoint_fullfsync = false`),e.pragma(`synchronous = OFF`)}function hf(e){e.pragma(`checkpoint_fullfsync = true`),e.pragma(`synchronous = FULL`),e.pragma(`wal_checkpoint(FULL)`)}function gf(e){e.transaction(()=>{vf(e),_f(e),e.exec(`DROP TRIGGER IF EXISTS messages_on_insert`),e.exec(In),e.exec(`DROP TRIGGER IF EXISTS messages_on_insert_insert_mentions`),e.exec(`
      CREATE TRIGGER messages_on_insert_insert_mentions AFTER INSERT ON messages
      BEGIN
        INSERT INTO mentions (messageId, mentionAci, start, length)
        ${pf}
        AND messages.id = new.id;
      END;
    `),us(e,{id:`messageInsertTriggersDisabled`,value:!1})})()}function _f(e){e.exec(`
    DELETE FROM messages_fts;
    INSERT OR REPLACE INTO messages_fts (rowid, body)
      SELECT rowid, searchableText
      FROM messages
      WHERE isSearchable = 1;
  `)}function vf(e){e.exec(`
    DELETE FROM mentions;
    INSERT INTO mentions (messageId, mentionAci, start, length)
    ${pf};
  `)}function yf(e){e.transaction(()=>{ds(e,`messageInsertTriggersDisabled`)?.value&&(V.warn(`Message insert triggers were disabled; reenabling and backfilling data`),gf(e))})()}function bf(e,t){let n;try{e.pragma(`query_only = on`),n=e.prepare(t).all()}finally{e.pragma(`query_only = off`)}return n}if(!u.parentPort)throw Error(`Must run as a worker thread`);const xf=u.parentPort;function Z(e,t){let n={type:`response`,seq:e,error:void 0,errorKind:void 0,response:t};xf.postMessage(n)}let Q,$=!1,Sf=!1;const Cf=({seq:e,request:t},n=!1)=>{try{if(t.type===`init`){$=t.isPrimary,Sf=!1,$&&R.setOnCheckpointNeeded(e=>{let t={type:`walCheckpointNeeded`,reason:e};xf.postMessage(t)}),Q=Oo({...t.options,isPrimary:$}),Z(e,void 0);return}if(Sf&&t.type===`close`){Z(e,void 0),process.exit(0);return}if(t.type===`removeDB`){try{Q&&=($?vo.close(Q):_o.close(Q),void 0)}catch{$a.error(`Failed to close database before removal`)}$&&jo(),Sf=!0,Z(e,void 0);return}if(!Q)throw Error(`Not initialized`);if(t.type===`close`){$?vo.close(Q):_o.close(Q),Q=void 0,Z(e,void 0),process.exit(0);return}if(t.type===`walCheckpoint`){Q!=null&&R.runImmediately(Q,$a,t.reason),Z(e,void 0);return}if(t.type===`sqlCall:read`||t.type===`sqlCall:write`){let n=(t.type===`sqlCall:read`?_o:vo)[t.method];if(typeof n!=`function`)throw Error(`Invalid sql method: ${t.method} ${n}`);let r=t.encoding===`js`?t.args:(0,d.deserialize)(t.data),i=performance.now(),a=n(Q,...r),o=performance.now()-i;Z(e,{result:t.encoding===`js`?a:(0,d.serialize)(a),duration:o})}else throw Error(`Unexpected request type`)}catch(i){let a=r.n(i);if((a===r.t.Corrupted||a===r.t.Logic)&&Q!=null&&vo.runCorruptionChecks(Q)&&!n&&(t.type===`sqlCall:read`||t.type===`sqlCall:write`))return $a.error(`Retrying request: ${t.type}`),Cf({seq:e,request:t},!0);let o={type:`response`,seq:e,error:{name:i.name,message:i.message,stack:i.stack},errorKind:a,response:void 0};xf.postMessage(o)}};xf.on(`message`,e=>Cf(e));
//# sourceURL=bundles:///workers/sql.js