class Solution {
    public String longestCommonPrefix(String[] strs) {
        if (strs == null || strs.length == 0) return "";

        boolean chk = false;
        String prefix = "";

        for (int i = 0; i < strs[0].length(); i++) {
            prefix = strs[0].substring(0, strs[0].length() - i);
            for (int j = 0; j < strs.length; j++) {
                if (!strs[j].startsWith(prefix)) {
                    chk = false;
                    break;
                }
                chk = true;
            }
            if (chk) break;
        }

        // 끝까지 일치하는 접두사를 못 찾았으면 빈 문자열 반환
        return chk ? prefix : "";
    }
}
