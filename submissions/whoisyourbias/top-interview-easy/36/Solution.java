class Solution {
    public boolean isValidSudoku(char[][] board) {
        for (int i = 0; i < 9; i++) {
            if (!validateRow(board, i)) {
                return false;
            }
            if (!validateCol(board, i)) {
                return false;
            }
        }

        // 0, 3, 6
        int i = 0;
        while (i < 9) {
            int j = 0;
            while (j < 9) {
                if (!validateBox(board,i,j)) {
                    return false;
                }
                j += 3;
            }
            i += 3;
        }
        return true;
    }

    boolean validateRow(char[][] board, int i) {
        boolean[] v = new boolean[10];
        
        for (int j = 0; j < 9; j++) {
            if (!validate(board[i][j], v)) {
                return false;
            }
        }
        return true;
    }

    boolean validateCol(char[][] board, int i) {
        boolean[] v = new boolean[10];
        
        for (int j = 0; j < 9; j++) {
            if (!validate(board[j][i], v)) {
                return false;
            }
        }

        return true;
    }

    boolean validateBox(char[][] board, int i, int j) {
        boolean[] v = new boolean[10];
        
        for (int iv = i; iv < i + 3; iv++) {
            for (int jv = j; jv < j + 3; jv++) {
                if (!validate(board[iv][jv], v)) {
                    return false;
                }
            }
        }

        return true;
    }

    boolean validate(char c, boolean[] v) {
        if (!isInt(c)) {
            return true;
        }
        int value = c - '0';
        if (v[value]) {
            return false;
        }
        v[value] = true;
        return true;
    }

    boolean isInt(char c) {
        if (c >= '0' && c <= '9' ) {
            return true;
        }
        return false;
    }
}
