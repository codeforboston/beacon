export interface Conversation {
    id: string,
    name: string,
    is_channel: boolean,
    is_group: boolean,
    is_im: boolean,
    created: number,
    creator: string,
    is_archived: boolean,
    is_general: boolean,
    unlinked: number,
    name_normalized: string,
    is_read_only: boolean,
    is_shared: boolean,
    parent_conversation: null,
    is_ext_shared: boolean,
    is_org_shared: boolean,
    pending_shared: [],
    is_pending_ext_shared: boolean,
    is_member: boolean,
    is_private: boolean,
    is_mpim: boolean,
    last_read: string,
    topic: {
        value: string,
        creator: string,
        last_set: number
    },
    purpose: {
        value: string,
        creator: string,
        last_set: number
    },
    previous_names: string[],
    locale: string
}

export interface UserProfile {
    avatar_hash: string,
    status_text: string,
    status_emoji: string,
    status_expiration: number,
    real_name: string,
    display_name: string,
    real_name_normalized: string,
    display_name_normalized: string,
    email: string,
    image_original: string,
    image_24: string,
    image_32: string,
    image_48: string,
    image_72: string,
    image_192: string,
    image_512: string,
    team: string
}
