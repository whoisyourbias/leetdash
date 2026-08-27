class Solution {
    public boolean isValidSudoku(char[][] board) {
        boolean[][] row = new boolean[9][9];
        boolean[][] col = new boolean[9][9];
        boolean[][] box = new boolean[9][9];

        for (int i =0; i<9 ;i++){
            for (int j =0; j<9 ;j++){
                int boxIndex = (i / 3) * 3 + (j / 3);
                if(board[i][j]=='.') continue;
                int pos = board[i][j]-'1';
                
                if(row[i][pos]
                ||col[j][pos]
                ||box[boxIndex][pos]) return false;

                row[i][pos] = true;
                col[j][pos] = true;
                box[boxIndex][pos] = true;
            }
        }
        return true;
    }
}